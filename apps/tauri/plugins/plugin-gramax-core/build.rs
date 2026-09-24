const COMMANDS: &[&str] = &[
	"getstat",
	"write_file",
	"read_dir",
	"read_link",
	"make_dir",
	"remove_dir",
	"rmfile",
	"mv",
	"hardlink",
	"stat",
	"exists",
	"copy",
	"read_dir_stats",
	"delete_empty_dirs",
	"init_new",
	"clone",
	"cancel",
	"recover",
	"file_history",
	"checkout",
	"fetch",
	"stash",
	"stash_apply",
	"stash_restore",
	"stash_list",
	"push",
	"add",
	"status",
	"status_file",
	"branch_info",
	"new_branch",
	"stash_delete",
	"delete_branch",
	"get_remote",
	"branch_list",
	"diff",
	"add_remote",
	"has_remotes",
	"reset",
	"commit",
	"merge",
	"restore",
	"get_parent",
	"get_content",
	"count_changed_files",
	"get_commit_info",
	"find_refs_by_globs",
	"is_init",
	"is_bare",
	"set_head",
	"default_branch",
	"git_read_dir",
	"git_file_stat",
	"git_file_exists",
	"git_read_dir_stats",
	"list_merge_requests",
	"create_or_update_merge_request",
	"get_draft_merge_request",
	"get_commit_authors",
	"get_commit_range",
	"pull_lfs_objects",
	"gc",
	"get_all_cancel_tokens",
	"reset_repo",
	"reset_file_lock",
	"format_merge_message",
	"get_config_val",
	"set_config_val",
	"storage_stats",
	"lfs_prune",
	"healthcheck",
	"scan_workspace",
	"scan_catalog",
	"watch_workspace",
	"unwatch_workspace",
	"has_merge_conflicts"
];

fn main() {
	assert_permissions_cover_commands();
	tauri_plugin::Builder::new(COMMANDS).android_path("android").ios_path("ios").build();
}

/// Fails the build when `permissions/default.toml` and `COMMANDS` disagree.
///
/// A command missing from the permission list is not a build error by itself — it is denied at
/// runtime, in the desktop app only, with nothing anywhere to say why. This is the cheapest place to
/// notice, and the list is small enough to compare by hand: every name between `commands.allow = [`
/// and its closing bracket.
fn assert_permissions_cover_commands() {
	const PERMISSIONS: &str = "permissions/default.toml";

	println!("cargo:rerun-if-changed={PERMISSIONS}");

	let file = std::fs::read_to_string(PERMISSIONS).expect("permissions/default.toml is missing");
	let list = file
		.split_once("commands.allow = [")
		.and_then(|(_, rest)| rest.split_once(']'))
		.map(|(list, _)| list)
		.expect("permissions/default.toml has no `commands.allow` list");

	let allowed: Vec<&str> = list.split(',').filter_map(|line| line.trim().strip_prefix('"')).filter_map(|line| line.strip_suffix('"')).collect();

	let missing: Vec<&str> = COMMANDS.iter().filter(|command| !allowed.contains(command)).copied().collect();
	let unknown: Vec<&str> = allowed.iter().filter(|command| !COMMANDS.contains(command)).copied().collect();

	assert!(
		missing.is_empty() && unknown.is_empty(),
		"permissions/default.toml is out of step with COMMANDS.\n  missing from the permission list: {missing:?}\n  listed but not a command: {unknown:?}"
	);
}
