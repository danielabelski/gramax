use test_utils::git::*;
use test_utils::*;

#[rstest]
pub fn add_delete(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("file"), "content")?;
	fs::create_dir(sandbox.path().join("dir"))?;
	fs::write(sandbox.path().join("dir/file2"), "content")?;

	repo.add_glob(vec!["file", "dir/file2"])?;

	let status = repo.status(true)?.short_info()?;
	let mut entries = status.entries().iter();

	assert_eq!(entries.next().unwrap().path, Path::new("dir/file2"));
	assert_eq!(entries.next().unwrap().path, Path::new("file"));

	repo.commit_debug()?;

	fs::write(sandbox.path().join("new-file"), "content")?;
	fs::remove_dir_all(sandbox.path().join("dir"))?;
	repo.add_glob(vec!["file", "new-file", "dir", "not-exists"])?;

	let status = repo.status(true)?.short_info()?;
	let mut entries = status.entries().iter();

	let del_dir = entries.next().unwrap();
	assert_eq!(del_dir.path, Path::new("dir/file2"));
	assert_eq!(del_dir.status, StatusEntry::Delete);

	let new = entries.next().unwrap();
	assert_eq!(new.path, Path::new("new-file"));
	assert_eq!(new.status, StatusEntry::New);

	assert!(entries.next().is_none());

	fs::remove_file(sandbox.path().join("file"))?;
	repo.add_glob(vec!["file"])?;

	let status = repo.status(true)?.short_info()?;
	let mut entries = status.entries().iter();

	assert!(entries.any(|e| e.path.eq(Path::new("file"))));

	Ok(())
}

#[rstest]
pub fn add_resolve_rename(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("file"), "content")?;
	fs::create_dir(sandbox.path().join("dir"))?;
	fs::write(sandbox.path().join("dir/file2"), "content")?;
	fs::write(sandbox.path().join("dir/file"), "content")?;

	repo.add_glob(vec!["file", "dir"])?;

	let status = repo.status(true)?.short_info()?;
	let mut entries = status.entries().iter();

	assert_eq!(entries.next().unwrap().path, Path::new("dir/file"));
	assert_eq!(entries.next().unwrap().path, Path::new("dir/file2"));
	assert_eq!(entries.next().unwrap().path, Path::new("file"));

	repo.commit_debug()?;

	fs::rename(sandbox.path().join("dir"), sandbox.path().join("dir_2"))?;

	repo.add_glob(vec!["dir", "dir_2"])?;

	let status = repo.status(true)?.short_info()?;
	let expect = vec![
		StatusInfoEntry {
			path: PathBuf::from("dir/file"),
			status: StatusEntry::Delete,
		},
		StatusInfoEntry {
			path: PathBuf::from("dir/file2"),
			status: StatusEntry::Delete,
		},
		StatusInfoEntry {
			path: PathBuf::from("dir_2/file"),
			status: StatusEntry::New,
		},
		StatusInfoEntry {
			path: PathBuf::from("dir_2/file2"),
			status: StatusEntry::New,
		},
	];

	for entry in expect {
		assert!(status.entries().contains(&entry));
	}

	Ok(())
}

fn index_snapshot(repo: &Repo<TestCreds>) -> Result<std::collections::HashMap<String, String>> {
	let index = repo.repo().index()?;
	let entries = index
		.iter()
		.map(|entry| (String::from_utf8(entry.path.clone()).unwrap(), format!("{entry:?}")))
		.collect();
	Ok(entries)
}

#[rstest]
pub fn add_force_touches_only_given_paths(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let root = sandbox.path();

	fs::write(root.join(".gitignore"), "ignored\n")?;
	fs::create_dir(root.join("dir"))?;
	for name in ["a", "b", "c"] {
		fs::write(root.join("dir").join(name), "content")?;
	}

	repo.add_all()?;
	repo.commit_debug()?;

	let before = index_snapshot(&repo)?;
	assert_eq!(before.len(), 4);

	for name in ["a", "b", "c"] {
		fs::write(root.join("dir").join(name), "content changed")?;
	}

	repo.add_glob_force(vec!["dir/a", "dir/b"])?;

	let after = index_snapshot(&repo)?;

	assert_ne!(before["dir/a"], after["dir/a"]);
	assert_ne!(before["dir/b"], after["dir/b"]);
	assert_eq!(before["dir/c"], after["dir/c"]);
	assert_eq!(before[".gitignore"], after[".gitignore"]);

	Ok(())
}

#[rstest]
pub fn add_force_respects_gitignore(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let root = sandbox.path();

	fs::write(root.join(".gitignore"), "ignored\nignored-dir/\n")?;
	fs::write(root.join("file"), "content")?;
	fs::write(root.join("ignored"), "content")?;
	fs::create_dir(root.join("ignored-dir"))?;
	fs::write(root.join("ignored-dir/nested"), "content")?;

	repo.add_all()?;

	let staged = index_snapshot(&repo)?;
	assert!(!staged.contains_key("ignored"));
	assert!(!staged.contains_key("ignored-dir/nested"));

	repo.add_glob_force(vec!["ignored"])?;
	repo.add_glob_force(vec!["ignored-dir"])?;
	repo.add_glob_force(vec!["file", "ignored", "ignored-dir/nested"])?;

	let staged = index_snapshot(&repo)?;
	assert!(staged.contains_key("file"));
	assert!(!staged.contains_key("ignored"));
	assert!(!staged.contains_key("ignored-dir/nested"));

	Ok(())
}

#[rstest]
pub fn add_force_stages_deletions(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let root = sandbox.path();

	fs::write(root.join("file"), "content")?;
	fs::create_dir(root.join("dir"))?;
	fs::write(root.join("dir/nested"), "content")?;

	repo.add_all()?;
	repo.commit_debug()?;

	fs::remove_file(root.join("file"))?;
	fs::remove_dir_all(root.join("dir"))?;

	repo.add_glob_force(vec!["file", "dir", "not-exists"])?;

	let staged = index_snapshot(&repo)?;
	assert!(!staged.contains_key("file"));
	assert!(!staged.contains_key("dir/nested"));

	let status = repo.status(true)?.short_info()?;
	let entries = status.entries();

	assert!(entries.iter().any(|e| e.path == Path::new("file") && e.status == StatusEntry::Delete));
	assert!(entries
		.iter()
		.any(|e| e.path == Path::new("dir/nested") && e.status == StatusEntry::Delete));

	Ok(())
}

/// An ignored file that is already tracked keeps being staged — the second half of the rule.
///
/// `index.add_all` with `IndexAddOption::DEFAULT` skips an ignored path only while git does not know
/// it. Once a file is in the index, later edits to it stage as usual, ignore rule or not; without
/// that half, a tracked file someone later covered with a `.gitignore` line would quietly stop
/// being committed.
#[rstest]
pub fn add_force_stages_an_ignored_file_that_is_already_tracked(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let root = sandbox.path();

	fs::write(root.join("tracked"), "first")?;
	repo.add_glob(vec!["tracked"])?;
	repo.commit_debug()?;

	// The rule arrives after the file is already in the index.
	fs::write(root.join(".gitignore"), "tracked\n")?;
	fs::write(root.join("tracked"), "second")?;

	repo.add_glob_force(vec!["tracked"])?;

	let staged = index_snapshot(&repo)?;
	assert!(staged.contains_key("tracked"));

	let status = repo.status(true)?.short_info()?;
	assert!(status.entries().iter().any(|entry| entry.path == Path::new("tracked")));

	Ok(())
}

/// A symlink whose target is gone is still a file git tracks, and not a deletion.
///
/// The dispatch between "stage this" and "stage a deletion" used to ask `Path::exists`, which
/// follows the link and answers about its target. A link pointing at something removed therefore
/// arrived as a deletion, and `index.remove_all` took the link out of the index while it was still
/// lying in the working copy.
#[cfg(unix)]
#[rstest]
pub fn add_force_keeps_a_symlink_whose_target_is_missing(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let root = sandbox.path();

	std::os::unix::fs::symlink(root.join("nowhere"), root.join("link"))?;
	assert!(!root.join("link").exists(), "the target is missing, so `exists` says no");

	repo.add_glob_force(vec!["link"])?;

	let staged = index_snapshot(&repo)?;
	assert!(staged.contains_key("link"), "the link itself is what git stores");

	Ok(())
}
