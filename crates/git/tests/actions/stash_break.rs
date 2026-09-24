//! Adversarial probes against the rewritten stash (`crates/git/src/actions/stash.rs`),
//! the path-scoped merge checkout (`merge.rs`) and `reset --hard` (`reset.rs`).
//!
//! Every assertion states the behaviour `git` itself has. A failure here is a divergence.

use std::process::Command;

use test_utils::git::*;
use test_utils::*;

fn git(dir: &Path, args: &[&str]) -> String {
	let out = Command::new("git")
		.args(args)
		.current_dir(dir)
		.env("GIT_AUTHOR_NAME", "t")
		.env("GIT_AUTHOR_EMAIL", "t@t.t")
		.env("GIT_COMMITTER_NAME", "t")
		.env("GIT_COMMITTER_EMAIL", "t@t.t")
		.output()
		.unwrap();
	String::from_utf8_lossy(&out.stdout).to_string() + &String::from_utf8_lossy(&out.stderr)
}

// ---------------------------------------------------------------------------
// 1. Unstaged edit sitting on top of a staged one
// ---------------------------------------------------------------------------

/// `git stash` stashes the *working copy*. An edit made after `git add` is part of it.
///
/// The stash here is built from the index, which by itself would carry `v2` and then reset the file
/// to `HEAD` — losing `v3`, since that path is in the index-vs-head diff either way. It does not,
/// because the changed paths are re-read from disk just before the stash is written
/// (`refresh_index_at`), so what the user last typed is what travels.
#[rstest]
fn unstaged_edit_on_top_of_staged_is_kept(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let file = sandbox.path().join("file");

	fs::write(&file, "v1")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(&file, "v2")?;
	repo.add("file")?;
	fs::write(&file, "v3")?;

	let oid = repo.stash(None)?.expect("something to stash");
	assert_eq!(fs::read_to_string(&file)?, "v1", "working copy must go back to HEAD");

	repo.stash_apply(oid)?;
	assert_eq!(fs::read_to_string(&file)?, "v3", "the newest content the user typed must come back");
	Ok(())
}

/// The same shape, checked against real `git` on the very same repository.
#[rstest]
fn reference_git_stashes_the_working_copy(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("file");

	fs::write(&file, "v1")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(&file, "v2")?;
	repo.add("file")?;
	fs::write(&file, "v3")?;

	git(path, &["stash", "push", "-m", "reference"]);
	assert_eq!(fs::read_to_string(&file)?, "v1");
	git(path, &["stash", "apply"]);
	assert_eq!(fs::read_to_string(&file)?, "v3", "reference git keeps the unstaged edit");
	Ok(())
}

// ---------------------------------------------------------------------------
// 2. Change that lives only in the working copy
// ---------------------------------------------------------------------------

/// A change that never reached the index is not stashed — and not touched either.
///
/// This is where the rewrite parts with `git stash`: the stash is built from the index, so a file
/// edited on disk without being staged is invisible to it. Gramax stages every write through the
/// file provider's events, so in the product this state is a gap in that staging rather than a normal
/// one. What matters is what happens then: the change stays exactly where it was. It is not carried
/// away, and — since the reset is scoped to the paths the stash did take — not overwritten.
#[rstest]
fn workdir_only_change_is_left_where_it_is(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let file = sandbox.path().join("file");

	fs::write(&file, "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(&file, "edited, never staged")?;

	assert!(repo.stash(None)?.is_none(), "the index holds no change, so there is nothing to stash");
	assert_eq!(fs::read_to_string(&file)?, "edited, never staged", "and the edit is still on disk");
	Ok(())
}

// ---------------------------------------------------------------------------
// 3. File names that are also glob patterns
// ---------------------------------------------------------------------------

/// libgit2 treats `CheckoutBuilder::path` entries as pathspecs, i.e. fnmatch patterns. A file whose
/// name contains `[`, `*` or `?` therefore does not match itself, and every path-scoped checkout
/// silently skips it.
#[rstest]
fn stash_resets_a_file_named_like_a_glob(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let file = sandbox.path().join("note[1].md");

	fs::write(&file, "committed")?;
	repo.add("note[1].md")?;
	repo.commit_debug()?;

	fs::write(&file, "staged edit")?;
	repo.add("note[1].md")?;

	repo.stash(None)?.expect("something to stash");
	assert_eq!(fs::read_to_string(&file)?, "committed", "the stash must return the file to HEAD");
	Ok(())
}

/// Same defect on the receiving side: a fast-forward writes only the paths the diff names, so an
/// incoming change to such a file never lands on disk although `HEAD` moves over it.
#[rstest]
fn merge_writes_a_file_named_like_a_glob(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("note[1].md");

	fs::write(&file, "base")?;
	repo.add("note[1].md")?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(&file, "from server")?;
	repo.add("note[1].md")?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	repo.merge(MergeOptions::theirs("other"))?;

	assert_eq!(fs::read_to_string(&file)?, "from server", "the pulled content must be on disk");
	Ok(())
}

/// And on the apply side.
#[rstest]
fn stash_apply_restores_a_file_named_like_a_glob(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let file = sandbox.path().join("draft*.md");

	fs::write(&file, "committed")?;
	repo.add("draft*.md")?;
	repo.commit_debug()?;

	fs::write(&file, "my edit")?;
	repo.add("draft*.md")?;

	let oid = repo.stash(None)?.expect("something to stash");
	repo.stash_apply(oid)?;
	assert_eq!(fs::read_to_string(&file)?, "my edit", "the stashed content must come back");
	Ok(())
}

// ---------------------------------------------------------------------------
// 4. Untracked / ignored files meeting incoming changes
// ---------------------------------------------------------------------------

/// The stash no longer carries untracked files, so a pull can now find one sitting exactly where an
/// incoming commit wants to write. `git merge` refuses in this situation; whatever happens here, the
/// user's file must not disappear without a copy of it existing somewhere.
#[rstest]
fn incoming_commit_over_untracked_file(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("new.md");

	fs::write(path.join("seed"), "seed")?;
	repo.add("seed")?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(&file, "from server")?;
	repo.add("new.md")?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	assert!(!file.exists());
	fs::write(&file, "my untracked work")?;

	let merged = repo.merge(MergeOptions::theirs("other"));

	assert!(merged.is_err(), "a merge that would overwrite an untracked file must refuse, like git does");
	assert_eq!(fs::read_to_string(&file)?, "my untracked work");
	Ok(())
}

/// An ignored file in the way of an incoming (force-added) file.
#[rstest]
fn incoming_commit_over_ignored_file(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("build.log");

	fs::write(path.join(".gitignore"), "*.log\n")?;
	repo.add(".gitignore")?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(&file, "from server")?;
	repo.add("build.log")?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	fs::write(&file, "my local log")?;

	let merged = repo.merge(MergeOptions::theirs("other"));
	if merged.is_ok() {
		assert_eq!(fs::read_to_string(&file)?, "from server", "if the merge succeeds the file must hold the pulled content");
	}
	Ok(())
}

/// `stash_apply` force-checks-out. An untracked file standing where the stash wants to land is
/// overwritten without a word; `git stash apply` refuses instead.
#[rstest]
fn stash_apply_does_not_eat_an_untracked_file(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("new.md");

	fs::write(path.join("seed"), "seed")?;
	repo.add("seed")?;
	repo.commit_debug()?;

	fs::write(&file, "stashed content")?;
	repo.add("new.md")?;
	let oid = repo.stash(None)?.expect("something to stash");
	assert!(!file.exists());

	fs::write(&file, "written again by hand")?;

	let applied = repo.stash_apply(oid);
	assert!(
		applied.is_err() || fs::read_to_string(&file)? == "written again by hand",
		"the untracked file must not be silently replaced"
	);
	Ok(())
}

// ---------------------------------------------------------------------------
// 5. File kinds: symlinks, exec bit, unusual names, empty dirs
// ---------------------------------------------------------------------------

#[cfg(unix)]
#[rstest]
fn symlink_roundtrip(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("target"), "target")?;
	repo.add("target")?;
	repo.commit_debug()?;

	std::os::unix::fs::symlink("target", path.join("link"))?;
	repo.add("link")?;

	let oid = repo.stash(None)?.expect("something to stash");
	assert!(!path.join("link").symlink_metadata().is_ok(), "the stashed symlink must be gone");

	repo.stash_apply(oid)?;
	let meta = path.join("link").symlink_metadata()?;
	assert!(meta.file_type().is_symlink(), "it must come back as a symlink, not as a regular file");
	Ok(())
}

#[cfg(unix)]
#[rstest]
fn exec_bit_roundtrip(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	use std::os::unix::fs::PermissionsExt;
	let path = sandbox.path();
	let file = path.join("run.sh");

	fs::write(&file, "#!/bin/sh\n")?;
	repo.add("run.sh")?;
	repo.commit_debug()?;

	fs::set_permissions(&file, fs::Permissions::from_mode(0o755))?;
	repo.add("run.sh")?;

	let oid = repo.stash(None)?.expect("a mode change is a change");
	assert_eq!(fs::metadata(&file)?.permissions().mode() & 0o111, 0, "the stash must undo the chmod");

	repo.stash_apply(oid)?;
	assert_ne!(fs::metadata(&file)?.permissions().mode() & 0o111, 0, "the chmod must come back");
	Ok(())
}

#[rstest]
#[case::cyrillic("статья.md")]
#[case::spaces("my article.md")]
#[case::both("моя статья 1.md")]
#[case::hash("release #4.md")]
fn odd_names_roundtrip(
	sandbox: TempDir,
	#[with(&sandbox)] mut repo: Repo<TestCreds>,
	#[case] name: &str,
) -> Result {
	let file = sandbox.path().join(name);

	fs::write(&file, "committed")?;
	repo.add(name)?;
	repo.commit_debug()?;

	fs::write(&file, "edited")?;
	repo.add(name)?;

	let oid = repo.stash(None)?.expect("something to stash");
	assert_eq!(fs::read_to_string(&file)?, "committed", "{name}: stash must reset the working copy");

	repo.stash_apply(oid)?;
	assert_eq!(fs::read_to_string(&file)?, "edited", "{name}: apply must restore the edit");
	Ok(())
}

#[rstest]
fn very_long_path_roundtrip(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let rel = (0..12).map(|i| format!("d{i}{}", "x".repeat(15))).collect::<Vec<_>>().join("/") + "/article.md";

	let file = path.join(&rel);
	fs::create_dir_all(file.parent().unwrap())?;
	fs::write(&file, "committed")?;
	repo.add(&rel)?;
	repo.commit_debug()?;

	fs::write(&file, "edited")?;
	repo.add(&rel)?;

	let oid = repo.stash(None)?.expect("something to stash");
	assert_eq!(fs::read_to_string(&file)?, "committed");
	repo.stash_apply(oid)?;
	assert_eq!(fs::read_to_string(&file)?, "edited");
	Ok(())
}

// ---------------------------------------------------------------------------
// 6. Renames, case changes, deletions
// ---------------------------------------------------------------------------

#[rstest]
fn rename_with_edit_roundtrip(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("old.md"), "line1\nline2\nline3\n")?;
	repo.add("old.md")?;
	repo.commit_debug()?;

	fs::rename(path.join("old.md"), path.join("new.md"))?;
	fs::write(path.join("new.md"), "line1\nCHANGED\nline3\n")?;
	repo.add_all()?;

	let oid = repo.stash(None)?.expect("something to stash");
	assert!(path.join("old.md").exists(), "the old name must be back");
	assert!(!path.join("new.md").exists(), "the new name must be gone");

	repo.stash_apply(oid)?;
	assert!(!path.join("old.md").exists(), "after apply the old name must be gone again");
	assert_eq!(fs::read_to_string(path.join("new.md"))?, "line1\nCHANGED\nline3\n");
	Ok(())
}

#[rstest]
fn delete_then_recreate_in_other_case(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("Readme.md"), "original")?;
	repo.add("Readme.md")?;
	repo.commit_debug()?;

	fs::remove_file(path.join("Readme.md"))?;
	fs::write(path.join("README.md"), "recreated")?;
	repo.add_all()?;

	let oid = repo.stash(None)?.expect("something to stash");
	repo.stash_apply(oid)?;

	let content = fs::read_to_string(path.join("README.md")).or_else(|_| fs::read_to_string(path.join("Readme.md")))?;
	assert_eq!(content, "recreated", "the file the user wrote must survive the round trip");
	Ok(())
}

#[rstest]
fn staged_deletion_roundtrip(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("gone.md"), "content")?;
	repo.add("gone.md")?;
	repo.commit_debug()?;

	fs::remove_file(path.join("gone.md"))?;
	repo.add_all()?;

	let oid = repo.stash(None)?.expect("a deletion is a change");
	assert!(path.join("gone.md").exists(), "the stash must bring the deleted file back");

	repo.stash_apply(oid)?;
	assert!(!path.join("gone.md").exists(), "the apply must delete it again");
	Ok(())
}

// ---------------------------------------------------------------------------
// 7. Odd HEAD states
// ---------------------------------------------------------------------------

#[rstest]
fn stash_on_detached_head(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "one")?;
	repo.add("file")?;
	let (first, _) = repo.commit_debug()?;
	fs::write(path.join("file"), "two")?;
	repo.add("file")?;
	repo.commit_debug()?;

	repo.repo().set_head_detached(first)?;
	repo.repo().checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

	fs::write(path.join("file"), "detached edit")?;
	repo.add("file")?;

	let oid = repo.stash(None)?.expect("something to stash");
	assert_eq!(fs::read_to_string(path.join("file"))?, "one");
	repo.stash_apply(oid)?;
	assert_eq!(fs::read_to_string(path.join("file"))?, "detached edit");
	Ok(())
}

#[rstest]
fn stash_in_repo_without_commits(sandbox: TempDir) -> Result {
	let dir = sandbox.path().join("empty");
	fs::create_dir_all(&dir)?;
	git2::Repository::init(&dir)?;

	let mut repo = Repo::open(&dir, TestCreds)?;
	fs::write(dir.join("file"), "first ever file")?;
	repo.add("file")?;

	// git says "You do not have the initial commit yet" and changes nothing. Whatever the answer,
	// it must not be a panic and the file must still be there.
	let _ = repo.stash(None);
	assert_eq!(fs::read_to_string(dir.join("file"))?, "first ever file");
	Ok(())
}

// ---------------------------------------------------------------------------
// 8. Several stashes, order, deletion
// ---------------------------------------------------------------------------

#[rstest]
fn two_stashes_are_both_kept_and_addressable(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("a"), "a1")?;
	fs::write(path.join("b"), "b1")?;
	repo.add("a")?;
	repo.add("b")?;
	repo.commit_debug()?;

	fs::write(path.join("a"), "a2")?;
	repo.add("a")?;
	let first = repo.stash(None)?.expect("first stash");

	fs::write(path.join("b"), "b2")?;
	repo.add("b")?;
	let second = repo.stash(None)?.expect("second stash");

	let mut listed = vec![];
	repo.repo_mut().stash_foreach(|_, _, oid| {
		listed.push(*oid);
		true
	})?;
	assert_eq!(listed, vec![second, first], "newest first, the way git lists them");

	// Applied out of order: the older stash first.
	repo.stash_apply(first)?;
	assert_eq!(fs::read_to_string(path.join("a"))?, "a2");
	repo.stash_apply(second)?;
	assert_eq!(fs::read_to_string(path.join("b"))?, "b2");
	assert_eq!(fs::read_to_string(path.join("a"))?, "a2", "applying the second stash must not undo the first");

	repo.stash_delete(first)?;
	let mut left = vec![];
	repo.repo_mut().stash_foreach(|_, _, oid| {
		left.push(*oid);
		true
	})?;
	assert_eq!(left, vec![second], "dropping the older stash keeps the newer one");
	Ok(())
}

#[rstest]
fn apply_after_head_moved_far_ahead(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("mine"), "base")?;
	fs::write(path.join("theirs"), "base")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("mine"), "my work")?;
	repo.add("mine")?;
	let oid = repo.stash(None)?.expect("something to stash");

	for i in 0..25 {
		fs::write(path.join("theirs"), format!("server commit {i}"))?;
		repo.add("theirs")?;
		repo.commit_debug()?;
	}

	repo.stash_apply(oid)?;
	assert_eq!(fs::read_to_string(path.join("mine"))?, "my work");
	assert_eq!(fs::read_to_string(path.join("theirs"))?, "server commit 24", "the newer history must stay");
	Ok(())
}

// ---------------------------------------------------------------------------
// 9. Interop with the real `git` binary
// ---------------------------------------------------------------------------

/// A stash `git stash push --include-untracked` made must be applicable by us — that is the stash a
/// user has when they update Gramax after putting work aside from a terminal.
#[rstest]
fn git_cli_stash_with_untracked_applies(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("tracked"), "committed")?;
	repo.add("tracked")?;
	repo.commit_debug()?;

	fs::write(path.join("tracked"), "edited")?;
	fs::write(path.join("untracked"), "brand new")?;

	git(path, &["stash", "push", "--include-untracked", "-m", "cli"]);
	assert!(!path.join("untracked").exists(), "git took the untracked file away");

	let oid = repo.repo().find_reference("refs/stash")?.peel_to_commit()?.id();
	repo.stash_apply(oid)?;

	assert_eq!(fs::read_to_string(path.join("tracked"))?, "edited");
	assert_eq!(fs::read_to_string(path.join("untracked"))?, "brand new", "the untracked file the stash carried must come back");
	Ok(())
}

/// And the other way: the stash we write must be a stash `git` can list and apply.
#[rstest]
fn our_stash_is_applicable_by_git_cli(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "my edit")?;
	repo.add("file")?;
	repo.stash(None)?.expect("something to stash");

	let list = git(path, &["stash", "list"]);
	assert!(list.contains("stash@{0}"), "git stash list must show it, got: {list}");

	let out = git(path, &["stash", "apply"]);
	assert_eq!(fs::read_to_string(path.join("file"))?, "my edit", "git stash apply said: {out}");
	Ok(())
}

// ---------------------------------------------------------------------------
// 10. Conflicted index fallback
// ---------------------------------------------------------------------------

/// With a conflicted index the code resets it and hands over to libgit2. The reset throws away what
/// was staged, so the fallback must at least still capture the working copy — otherwise the reset is
/// pure loss.
#[rstest]
fn conflicted_index_fallback_keeps_the_work(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("conflicted"), "base")?;
	fs::write(path.join("mine"), "base")?;
	repo.add_all()?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(path.join("conflicted"), "theirs")?;
	repo.add_all()?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	fs::write(path.join("conflicted"), "ours")?;
	repo.add_all()?;
	repo.commit_debug()?;

	let merged = repo.merge(MergeOptions::theirs("other"))?;
	assert!(merged.has_conflicts(), "the setup must produce a conflicted index");

	fs::write(path.join("mine"), "work done while conflicted")?;
	repo.add("mine")?;

	let oid = repo.stash(None)?.expect("a conflicted repository still has changes to stash");
	repo.stash_apply(oid)?;
	assert_eq!(
		fs::read_to_string(path.join("mine"))?,
		"work done while conflicted",
		"the fallback must not lose work the reset unstaged"
	);
	Ok(())
}

// ---------------------------------------------------------------------------
// 11. Recovery: reset --hard
// ---------------------------------------------------------------------------

/// `reset --hard` no longer removes untracked files. That matches `git reset --hard`, but a recovery
/// path that leaves a half-written file behind is worth pinning down.
#[rstest]
fn reset_hard_matches_git(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	use gramaxgit::actions::reset::*;
	let path = sandbox.path();

	fs::write(path.join(".gitignore"), "*.log\n")?;
	fs::write(path.join("tracked"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("tracked"), "dirty")?;
	fs::write(path.join("untracked"), "untracked")?;
	fs::write(path.join("thing.log"), "ignored")?;

	repo.reset(ResetOptions { mode: ResetMode::Hard, head: None })?;

	assert_eq!(fs::read_to_string(path.join("tracked"))?, "committed");
	assert!(path.join("untracked").exists(), "git reset --hard keeps untracked files");
	assert!(path.join("thing.log").exists(), "git reset --hard keeps ignored files");
	Ok(())
}
