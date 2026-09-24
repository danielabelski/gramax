const COMMANDS: &[&str] = &["mail_request"];

fn main() {
	tauri_plugin::Builder::new(COMMANDS).build();
}
