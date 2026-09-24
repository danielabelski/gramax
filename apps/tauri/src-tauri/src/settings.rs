use tauri::*;
use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::error::ShowError;

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use std::time::SystemTime;

use serde::Deserialize;
use serde::Serialize;

const SETTINGS_FILE_NAME: &str = "settings.json";

const TAG: &str = "app:settings";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(transparent)]
pub struct Settings(HashMap<String, serde_json::Value>);

impl Settings {
	pub fn get(&self, key: &str) -> Option<&serde_json::Value> {
		self.0.get(key)
	}
}

#[derive(Debug)]
struct SettingsStateInner {
	last_time_changed: u64,
	data: Settings,
}

type SettingsState = Mutex<SettingsStateInner>;

impl Default for SettingsStateInner {
	fn default() -> Self {
		Self {
			last_time_changed: time_now(),
			data: Settings(HashMap::new()),
		}
	}
}

pub fn get_settings_inner<R: Runtime>(manager: &AppHandle<R>) -> Result<Settings> {
	let path = manager.path().app_data_dir()?.join(SETTINGS_FILE_NAME);

	match manager.try_state::<SettingsState>() {
		Some(state) => get_actual_settings(manager, &state, &path)?,
		None => init_settings_state(manager, &path)?,
	}

	let state = manager.state::<SettingsState>().lock().unwrap().data.clone();
	Ok(state)
}

#[command]
pub fn get_settings<R: Runtime>(manager: AppHandle<R>) -> Result<Settings> {
	get_settings_inner(&manager)
}

#[command]
pub fn set_settings<R: Runtime>(manager: AppHandle<R>, data: HashMap<String, serde_json::Value>) -> Result<()> {
	let path = manager.path().app_data_dir()?.join(SETTINGS_FILE_NAME);

	if manager.try_state::<SettingsState>().is_none() {
		init_settings_state(&manager, &path)?;
	}

	std::fs::write(path, serde_json::to_string(&data)?)?;
	let state = manager.state::<SettingsState>();
	let mut state = state.lock().unwrap();
	state.last_time_changed = time_now();
	state.data = Settings(data);

	manager.emit("settings-data-updated", &state.data)?;
	Ok(())
}

pub fn update_setting<R: Runtime>(manager: &AppHandle<R>, key: &str, value: serde_json::Value) -> Result<()> {
	let path = manager.path().app_data_dir()?.join(SETTINGS_FILE_NAME);

	match manager.try_state::<SettingsState>() {
		Some(state) => get_actual_settings(manager, &state, &path)?,
		None => init_settings_state(manager, &path)?,
	}

	let state = manager.state::<SettingsState>();
	let mut state_guard = state.lock().unwrap();

	state_guard.data.0.insert(key.to_string(), value);
	state_guard.last_time_changed = time_now();

	std::fs::write(&path, serde_json::to_string(&state_guard.data.0)?)?;

	manager.emit("settings-data-updated", &state_guard.data)?;
	Ok(())
}

#[instrument(skip(app, state))]
fn get_actual_settings<R: Runtime>(app: &AppHandle<R>, state: &SettingsState, path: &Path) -> Result<()> {
	if !path.exists() {
		return Ok(());
	}

	let modified = path.metadata()?.modified()?.elapsed().unwrap_or(Duration::from_secs(0)).as_secs();

	let read_err = {
		let mut state = state.lock().unwrap();
		if state.last_time_changed >= modified {
			return Ok(());
		}

		state.last_time_changed = modified;
		match read_settings_file(path) {
			Ok(data) => {
				state.data = Settings(data);
				app.emit("settings-data-updated", &state.data)?;
				None
			}
			Err(err) => Some(err),
		}
	};

	// Сбрасываем файл уже без мьютекса: `reset_settings_file` показывает модальный
	// диалог, а тот крутит собственный run loop и может пропустить следующую IPC-команду,
	// которая полезет за тем же state.
	if let Some(err) = read_err {
		error!(target: TAG, "failed to read settings file at {}: {err}; state was not updated, resetting file", path.display());
		Span::current().set_status(opentelemetry::trace::Status::Error {
			description: err.to_string().into(),
		});
		reset_settings_file(path, err);
	}

	Ok(())
}

#[instrument(skip(manager))]
fn init_settings_state<R: Runtime, M: Manager<R>>(manager: &M, path: &Path) -> Result<()> {
	if !path.exists() {
		warn!(target: TAG, "settings file {} doesn't exist; state not inited", path.display());
		manager.manage::<SettingsState>(Mutex::default());
		return Ok(());
	}

	let data = match read_settings_file(path) {
		Ok(data) => data,
		Err(err) => {
			error!(target: TAG, "failed to read settings file at {}: {err}; resetting it", path.display());
			Span::current().set_status(opentelemetry::trace::Status::Error {
				description: err.to_string().into(),
			});
			// Регистрируем state до диалога: модальный run loop может пропустить
			// следующую IPC-команду, а та упадёт на `state()` без `manage()`.
			manager.manage::<SettingsState>(Mutex::default());
			reset_settings_file(path, err);
			return Ok(());
		}
	};

	let state = SettingsStateInner {
		data: Settings(data),
		..SettingsStateInner::default()
	};

	let is_managed = manager.manage::<SettingsState>(Mutex::new(state));
	if !is_managed {
		error!(target: TAG, "failed to manage settings state; state possibly was not updated");
		return Ok(());
	}

	Ok(())
}

fn read_settings_file(path: &Path) -> Result<HashMap<String, serde_json::Value>> {
	let content = std::fs::read_to_string(path)?;
	Ok(serde_json::from_str(&content)?)
}

fn reset_settings_file(path: &Path, cause: Error) {
	swap_corrupted_settings_file(path);
	let _ = std::result::Result::<(), Error>::Err(cause).or_show_with_message(&t!("etc.error.settings-file-read", path = path.display()));
}

/// Отодвигает нечитаемый файл в `.bak` и кладёт на его место пустой.
/// Обе операции best-effort: не получилось — только лог, вызывающий код продолжает работу.
fn swap_corrupted_settings_file(path: &Path) {
	let bak = path.with_extension("json.bak");
	match std::fs::rename(path, &bak) {
		Ok(()) => info!(target: TAG, "moved corrupted settings file to {}", bak.display()),
		Err(err) => warn!(target: TAG, "failed to move corrupted settings file to {}: {err}", bak.display()),
	}

	if let Err(err) = std::fs::write(path, "{}") {
		error!(target: TAG, "failed to recreate settings file at {}: {err}", path.display());
	}
}

fn time_now() -> u64 {
	SystemTime::now().elapsed().unwrap_or(Duration::from_secs(0)).as_secs()
}

#[cfg(test)]
mod tests {
	use super::*;

	fn temp_dir() -> std::path::PathBuf {
		let dir = std::env::temp_dir().join(format!("gramax-settings-test-{}", std::process::id()));
		let dir = dir.join(format!("{:?}", std::thread::current().id()));
		std::fs::create_dir_all(&dir).unwrap();
		dir
	}

	#[test]
	fn reads_valid_settings_file() {
		let path = temp_dir().join(SETTINGS_FILE_NAME);
		std::fs::write(&path, r#"{"ui":"ru"}"#).unwrap();

		let data = read_settings_file(&path).unwrap();
		assert_eq!(data.get("ui").unwrap(), "ru");
	}

	#[test]
	fn fails_on_invalid_utf8() {
		let path = temp_dir().join(SETTINGS_FILE_NAME);
		// Обрезанная запись посреди многобайтового символа — не ошибка парсинга, а ошибка чтения.
		std::fs::write(&path, [b'{', b'"', 0xE2, 0x82]).unwrap();

		assert!(read_settings_file(&path).is_err());
	}

	#[test]
	fn fails_on_invalid_json() {
		let path = temp_dir().join(SETTINGS_FILE_NAME);
		std::fs::write(&path, "{not json").unwrap();

		assert!(read_settings_file(&path).is_err());
	}

	#[test]
	fn swap_moves_corrupted_file_and_writes_empty_one() {
		let path = temp_dir().join(SETTINGS_FILE_NAME);
		let bak = path.with_extension("json.bak");
		_ = std::fs::remove_file(&bak);
		std::fs::write(&path, "{not json").unwrap();

		swap_corrupted_settings_file(&path);

		assert_eq!(std::fs::read_to_string(&bak).unwrap(), "{not json");
		assert_eq!(std::fs::read_to_string(&path).unwrap(), "{}");
		assert!(read_settings_file(&path).unwrap().is_empty());
	}

	#[test]
	fn swap_writes_empty_file_even_if_rename_fails() {
		let path = temp_dir().join(SETTINGS_FILE_NAME);
		// Файла нет — rename не может отработать, но пустой файл всё равно должен появиться.
		_ = std::fs::remove_file(&path);

		swap_corrupted_settings_file(&path);

		assert_eq!(std::fs::read_to_string(&path).unwrap(), "{}");
	}
}
