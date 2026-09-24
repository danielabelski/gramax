use std::path::{Path, PathBuf};

use tauri::*;

mod mem;
mod opentelemetry;
mod tracing;

pub use mem::force_find_processes;
pub use mem::init_mem_watching;
pub use tracing::init_tracing;
pub use tracing::reload_filter;

const LATEST_FILE: &str = "gx-latest.ndjson";
const FILE_PREFIX: &str = "gx-";
const FILE_SUFFIX: &str = ".ndjson";
const FILE_TIME_FORMAT: &str = "%Y-%m-%d_%H-%M-%S";

#[derive(Clone, Copy)]
pub enum LogScope {
	Session,
	Today,
	Last7Days,
	All,
}

impl LogScope {
	fn archive_tag(self) -> &'static str {
		match self {
			LogScope::Session => "session",
			LogScope::Today => "today",
			LogScope::Last7Days => "7d",
			LogScope::All => "all",
		}
	}

	fn window_days(self) -> Option<i64> {
		match self {
			LogScope::Today => Some(1),
			LogScope::Last7Days => Some(7),
			_ => None,
		}
	}
}

fn window_start(days: i64) -> chrono::NaiveDateTime {
	let first_day = chrono::Local::now().date_naive() - chrono::Duration::days(days - 1);
	first_day.and_time(chrono::NaiveTime::MIN)
}

fn started_at(name: &str) -> Option<chrono::NaiveDateTime> {
	let stamp = name.strip_prefix(FILE_PREFIX)?.strip_suffix(FILE_SUFFIX)?;
	chrono::NaiveDateTime::parse_from_str(stamp, FILE_TIME_FORMAT).ok()
}

fn last_write(entry: &std::fs::DirEntry) -> Option<chrono::NaiveDateTime> {
	let modified = entry.metadata().ok()?.modified().ok()?;
	Some(chrono::DateTime::<chrono::Local>::from(modified).naive_local())
}

fn scoped_files(logs_dir: &Path, scope: LogScope, current: Option<&Path>) -> std::io::Result<Vec<PathBuf>> {
	if let LogScope::Session = scope {
		let session = current.map(Path::to_path_buf).unwrap_or_else(|| logs_dir.join(LATEST_FILE));
		return Ok(if session.exists() { vec![session] } else { vec![] });
	}

	let start = scope.window_days().map(window_start);

	let mut files = Vec::new();
	for entry in std::fs::read_dir(logs_dir)? {
		let entry = entry?;
		let name = entry.file_name();
		let Some(name) = name.to_str() else { continue };

		if name == LATEST_FILE || !name.starts_with(FILE_PREFIX) || !name.ends_with(FILE_SUFFIX) {
			continue;
		}

		let path = entry.path();

		let included = match start {
			None => true,
			Some(start) => {
				current.is_some_and(|c| c == path.as_path())
					|| match (last_write(&entry), started_at(name)) {
						(None, None) => true,
						(end, begin) => end.is_some_and(|t| t >= start) || begin.is_some_and(|t| t >= start),
					}
			}
		};

		if included {
			files.push(path);
		}
	}

	files.sort();
	Ok(files)
}

pub fn collect_logs<R: Runtime>(app: &AppHandle<R>, scope: LogScope) -> tauri::Result<()> {
	use crate::error::ShowError as _;
	use std::io::BufWriter;
	use tauri_plugin_dialog::DialogExt;

	let logs_dir = app.path().app_data_dir()?.join("logs");
	if !logs_dir.exists() {
		return Ok(());
	}

	self::opentelemetry::flush_log_writer();

	let files = scoped_files(&logs_dir, scope, self::tracing::current_log_file())?;
	if files.is_empty() {
		return Ok(());
	}

	let archive_name = format!("logs-{}-{}.tar.xz", scope.archive_tag(), chrono::Local::now().format("%Y-%m-%d_%H-%M-%S"));

	let mut data = vec![];
	let mut tar = tar::Builder::new(&mut data);
	for file in &files {
		let entry_name = file.file_name().and_then(|n| n.to_str()).unwrap_or("log.ndjson");
		tar.append_path_with_name(file, format!("logs/{entry_name}"))?;
	}
	tar.finish()?;

	let Some(out_path) = app
		.dialog()
		.file()
		.set_file_name(&archive_name)
		.set_can_create_directories(true)
		.blocking_save_file()
	else {
		return Ok(());
	};

	drop(tar);

	let Ok(out_path) = out_path.into_path() else { return Ok(()) };

	let file = std::fs::File::options().create_new(true).write(true).open(out_path)?;
	let mut writer = BufWriter::new(file);
	_ = lzma_rs::xz_compress(&mut std::io::Cursor::new(data), &mut writer).or_show();

	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;
	use std::time::SystemTime;

	fn temp_dir(name: &str) -> PathBuf {
		let dir = std::env::temp_dir()
			.join(format!("gramax-logs-test-{}", std::process::id()))
			.join(name);
		_ = std::fs::remove_dir_all(&dir);
		std::fs::create_dir_all(&dir).unwrap();
		dir
	}

	fn noon(days_ago: i64) -> chrono::NaiveDateTime {
		let day = chrono::Local::now().date_naive() - chrono::Duration::days(days_ago);
		day.and_hms_opt(12, 0, 0).unwrap()
	}

	fn log_file(dir: &Path, started_days_ago: i64, written_days_ago: i64) -> PathBuf {
		let path = dir.join(format!("gx-{}.ndjson", noon(started_days_ago).format(FILE_TIME_FORMAT)));
		std::fs::write(&path, "{}\n").unwrap();

		let written: SystemTime = noon(written_days_ago).and_local_timezone(chrono::Local).earliest().unwrap().into();
		std::fs::File::options().write(true).open(&path).unwrap().set_modified(written).unwrap();

		path
	}

	fn names(files: &[PathBuf]) -> Vec<String> {
		files.iter().map(|f| f.file_name().unwrap().to_str().unwrap().to_string()).collect()
	}

	#[test]
	fn today_takes_session_started_earlier() {
		let dir = temp_dir("today-running");
		let running = log_file(&dir, 3, 0);

		let files = scoped_files(&dir, LogScope::Today, None).unwrap();

		assert_eq!(names(&files), names(&[running]));
	}

	#[test]
	fn today_skips_session_finished_earlier() {
		let dir = temp_dir("today-finished");
		log_file(&dir, 3, 3);

		let files = scoped_files(&dir, LogScope::Today, None).unwrap();

		assert!(files.is_empty(), "{:?}", names(&files));
	}

	#[test]
	fn today_takes_current_session_without_fresh_writes() {
		let dir = temp_dir("today-current");
		let current = log_file(&dir, 1, 1);

		let files = scoped_files(&dir, LogScope::Today, Some(&current)).unwrap();

		assert_eq!(names(&files), names(&[current]));
	}

	#[test]
	fn last_7_days_covers_calendar_window() {
		let dir = temp_dir("7d");
		let inside = log_file(&dir, 6, 6);
		log_file(&dir, 8, 8);

		let files = scoped_files(&dir, LogScope::Last7Days, None).unwrap();

		assert_eq!(names(&files), names(&[inside]));
	}

	#[test]
	fn all_takes_every_file_except_latest_link() {
		let dir = temp_dir("all");
		let old = log_file(&dir, 40, 40);
		let fresh = log_file(&dir, 0, 0);
		std::fs::write(dir.join(LATEST_FILE), "{}\n").unwrap();
		std::fs::write(dir.join("readme.txt"), "not a log").unwrap();

		let mut expected = names(&[old, fresh]);
		expected.sort();

		assert_eq!(names(&scoped_files(&dir, LogScope::All, None).unwrap()), expected);
	}

	#[test]
	fn session_prefers_current_file_over_latest_link() {
		let dir = temp_dir("session");
		let current = log_file(&dir, 2, 0);
		std::fs::write(dir.join(LATEST_FILE), "{}\n").unwrap();

		let files = scoped_files(&dir, LogScope::Session, Some(&current)).unwrap();

		assert_eq!(names(&files), names(&[current]));
	}

	#[test]
	fn session_falls_back_to_latest_link() {
		let dir = temp_dir("session-fallback");
		std::fs::write(dir.join(LATEST_FILE), "{}\n").unwrap();

		let files = scoped_files(&dir, LogScope::Session, None).unwrap();

		assert_eq!(names(&files), vec![LATEST_FILE.to_string()]);
	}
}
