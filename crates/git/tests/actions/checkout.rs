//! Switching branches writes what the two branches disagree about, and nothing else.
//!
//! `checkout_tree` over a whole tree walks the working copy: libgit2 builds the list of actions by
//! iterating it (`checkout.c`, `checkout_get_actions`), and on a browser filesystem that walk is the
//! entire cost — measured at 8,1 s of a 9,3 s branch switch on a catalog of 3458 files, where the
//! two branches differed in one file.
//!
//! These tests pin the outcome, not the walk: a native filesystem answers a stat in microseconds, so
//! a scoped checkout and a full one are indistinguishable from here — both write the same files and
//! leave the same working copy. That is deliberate. The walk is what the browser measurement counts
//! (`git::checkout` 8100 → 19 ms in `command-measure.spec.ts`); what can go wrong *here* is the
//! narrowing itself — a path the switch had to touch and no longer does.

use std::time::SystemTime;

use test_utils::git::*;
use test_utils::*;

fn modified_at(path: &std::path::Path) -> SystemTime {
	fs::metadata(path).unwrap().modified().unwrap()
}

/// The file the branches disagree about is written; the one they agree about is not touched at all.
#[rstest]
fn switching_branches_writes_only_what_differs(
	sandbox: TempDir,
	#[with(&sandbox)] mut repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("shared"), "same on both branches")?;
	fs::write(path.join("differs"), "on master")?;
	repo.add_all()?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(path.join("differs"), "on other")?;
	repo.add("differs")?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	assert_eq!(fs::read_to_string(path.join("differs"))?, "on master");

	// Taken after the working copy has settled on master, so it belongs to the file as this branch
	// left it. A checkout that rewrites everything moves it; one that writes the diff does not.
	let untouched_before = modified_at(&path.join("shared"));

	repo.checkout("other", false)?;

	assert_eq!(fs::read_to_string(path.join("differs"))?, "on other");
	assert_eq!(
		modified_at(&path.join("shared")),
		untouched_before,
		"a file both branches agree about must not be rewritten"
	);

	Ok(())
}

/// A file only one branch has appears and disappears with it.
#[rstest]
fn switching_branches_adds_and_removes_files(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("kept"), "on both")?;
	repo.add_all()?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(path.join("only-on-other"), "added on the branch")?;
	repo.add("only-on-other")?;
	repo.commit_debug()?;

	assert!(path.join("only-on-other").exists());

	repo.checkout("master", false)?;
	assert!(!path.join("only-on-other").exists(), "a file master never had must be gone");
	assert!(path.join("kept").exists());

	repo.checkout("other", false)?;
	assert_eq!(fs::read_to_string(path.join("only-on-other"))?, "added on the branch");

	Ok(())
}

/// An untracked file is not a branch's business, and a switch leaves it where it is.
#[rstest]
fn switching_branches_keeps_an_untracked_file(
	sandbox: TempDir,
	#[with(&sandbox)] mut repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	fs::write(path.join("untracked"), "never staged")?;

	repo.checkout("other", false)?;

	assert_eq!(fs::read_to_string(path.join("untracked"))?, "never staged");

	Ok(())
}

/// A checkout that has to overwrite a local edit refuses, unless it was told to force.
#[rstest]
fn switching_branches_refuses_over_a_local_edit(
	sandbox: TempDir,
	#[with(&sandbox)] mut repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "base")?;
	repo.add_all()?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(path.join("file"), "on other")?;
	repo.add("file")?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	fs::write(path.join("file"), "edited on master, never committed")?;

	let refusal = repo.checkout("other", false).expect_err("the edit is not this checkout's to discard");

	// A number is not something a user can act on. The file that stands in the way is.
	assert!(refusal.to_string().contains("file"), "the refusal has to name what blocks it: {refusal}");
	assert_eq!(fs::read_to_string(path.join("file"))?, "edited on master, never committed");

	Ok(())
}

/// A forced checkout still leaves nothing behind, including in files both branches agree about.
///
/// Forced is asked for exactly when the working copy must not survive — moving off a branch that no
/// longer exists upstream. Narrowing by pathspec would keep `checkout_get_actions` off every path
/// outside the tree diff, and a local edit in a file both trees share would ride along.
#[rstest]
fn a_forced_switch_discards_a_local_edit_anywhere(
	sandbox: TempDir,
	#[with(&sandbox)] mut repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("shared"), "same on both branches")?;
	fs::write(path.join("differs"), "on master")?;
	repo.add_all()?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(path.join("differs"), "on other")?;
	repo.add("differs")?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	fs::write(path.join("shared"), "edited on master, outside the tree diff")?;

	repo.checkout("other", true)?;

	assert_eq!(
		fs::read_to_string(path.join("shared"))?,
		"same on both branches",
		"a forced checkout has to discard the edit even where the trees agree"
	);

	Ok(())
}
