//! A directory we are not allowed to read is not a directory that is missing.
//!
//! On macOS the TCC prompt for `~/Desktop`, `~/Documents`, `~/Downloads`, iCloud Drive and
//! `/Volumes` turns every fs call into `EPERM`/`EACCES` until the user grants access. The fs
//! layer currently launders that refusal into "not found" (`Path::exists` swallows it, and every
//! other errno lands in `IoError::Other`), so the app tells the user their root path does not
//! exist instead of asking for permission. These tests pin the distinction at the bottom layer.

#![cfg(unix)]

use std::fs;
use std::io;
use std::io::ErrorKind;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::path::PathBuf;

use gramaxfs::backend::DiskFs;
use gramaxfs::backend::Fs;
use gramaxfs::error::IoError;
use tempfile::TempDir;

const EPERM: i32 = 1;
const EACCES: i32 = 13;

fn variant_of(err: &IoError) -> String {
	serde_json::to_value(err).unwrap()["name"].as_str().unwrap().to_owned()
}

/// A directory that exists but cannot be read — the closest deterministic stand-in for a
/// TCC-protected folder. Restores its mode on drop so the `TempDir` can clean itself up.
struct Unreadable {
	root: TempDir,
	dir: PathBuf,
}

impl Unreadable {
	/// `None` when the current user can read the directory anyway (running as root) — nothing
	/// to assert then.
	fn new() -> Option<Self> {
		let root = TempDir::new().unwrap();
		let dir = root.path().join("denied");
		fs::create_dir(&dir).unwrap();
		fs::write(dir.join("child.md"), b"content").unwrap();
		fs::set_permissions(&dir, fs::Permissions::from_mode(0o000)).unwrap();
		if fs::read_dir(&dir).is_ok() {
			fs::set_permissions(&dir, fs::Permissions::from_mode(0o755)).unwrap();
			return None;
		}
		Some(Self { root, dir })
	}

	fn disk(&self) -> DiskFs {
		DiskFs::new(self.root.path().to_path_buf())
	}
}

impl Drop for Unreadable {
	fn drop(&mut self) {
		let _ = fs::set_permissions(&self.dir, fs::Permissions::from_mode(0o755));
	}
}

macro_rules! unreadable_or_skip {
	() => {
		match Unreadable::new() {
			Some(u) => u,
			None => {
				eprintln!("skipped: this user can read a 0o000 directory (root?)");
				return;
			}
		}
	};
}

#[test]
fn permission_denied_error_kind_gets_its_own_variant() {
	let err = IoError::from(io::Error::from(ErrorKind::PermissionDenied));
	assert_eq!(variant_of(&err), "PermissionDenied");
}

#[test]
fn eperm_and_eacces_both_map_to_permission_denied() {
	// macOS TCC answers `EPERM` for a protected folder; a plain unreadable folder answers
	// `EACCES`. Both must reach the frontend as the same, nameable refusal.
	for errno in [EPERM, EACCES] {
		let err = IoError::from(io::Error::from_raw_os_error(errno));
		assert_eq!(variant_of(&err), "PermissionDenied", "errno {errno}");
	}
}

#[test]
fn exists_reports_the_refusal_instead_of_answering_no() {
	let denied = unreadable_or_skip!();

	let res = denied.disk().exists(Path::new("denied/child.md"));

	let err = res.expect_err("a path we are not allowed to look at is not a path that is absent");
	assert_eq!(variant_of(&err), "PermissionDenied");
}

#[test]
fn exists_on_the_unreadable_directory_itself_still_answers_yes() {
	// The directory is listed in its readable parent, so its presence is knowable without
	// entering it. Only what is *inside* is unknown.
	let denied = unreadable_or_skip!();

	assert!(denied.disk().exists(Path::new("denied")).unwrap());
}

#[test]
fn read_dir_names_reports_permission_denied() {
	let denied = unreadable_or_skip!();

	let err = denied.disk().read_dir_names(Path::new("denied")).expect_err("directory is unreadable");

	assert_eq!(variant_of(&err), "PermissionDenied");
}

#[test]
fn read_dir_stats_reports_permission_denied() {
	let denied = unreadable_or_skip!();

	let err = denied.disk().read_dir_stats(Path::new("denied")).expect_err("directory is unreadable");

	assert_eq!(variant_of(&err), "PermissionDenied");
}

#[test]
fn read_reports_permission_denied() {
	let denied = unreadable_or_skip!();

	let err = denied.disk().read(Path::new("denied/child.md")).expect_err("file is unreachable");

	assert_eq!(variant_of(&err), "PermissionDenied");
}

#[test]
fn exists_still_swallows_failures_that_are_not_refusals() {
	// `exists` answering `false` for every failure is what a lot of call sites are built on: the
	// version-scoped catalog fallthrough in `FileStructure::_assertReadable`, the watcher's
	// "can't see it, reload the catalog" branch, resource fallback resolution. Only the refusal
	// is worth propagating — widening this to every errno turns each of those into a hard error
	// on paths that merely cannot be probed (a component that is not a directory here, a bad
	// filename on Windows, a network mount mid-blip).
	let root = TempDir::new().unwrap();
	fs::write(root.path().join("file"), b"x").unwrap();
	let disk = DiskFs::new(root.path().to_path_buf());

	// ENOTDIR: `file` is not a directory, so it cannot have children.
	assert!(!disk.exists(Path::new("file/child")).unwrap());
}

#[test]
fn a_genuinely_missing_path_is_still_not_found() {
	// The counterpart guard: widening `PermissionDenied` must not swallow real absences,
	// which is what the workspace flow uses to offer "create this folder".
	let root = TempDir::new().unwrap();
	let disk = DiskFs::new(root.path().to_path_buf());

	assert!(!disk.exists(Path::new("nope")).unwrap());
	assert_eq!(variant_of(&disk.read_dir_names(Path::new("nope")).unwrap_err()), "NotFound");
}
