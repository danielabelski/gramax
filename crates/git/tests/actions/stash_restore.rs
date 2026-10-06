//! Putting a stash back long after it was taken, when the app has been restarted in between.
//!
//! `stash_apply` merges the stash with `HEAD`, which is right when the stash was taken a moment ago:
//! the working copy is at `HEAD` because the stash put it there. After a restart it is wrong twice
//! over — `HEAD` may have moved, and the user has been editing, with every edit going into the index
//! and not into `HEAD`. `stash_restore` merges with the index instead, so those edits are a side of
//! the merge rather than something in the way.

use test_utils::git::*;
use test_utils::*;

/// The list is `git stash list`: what Gramax wrote and what a person wrote, told apart.
#[rstest]
fn the_list_says_which_stashes_are_ours(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	assert!(repo.stash_list()?.is_empty(), "nothing has been stashed here yet");

	fs::write(path.join("file"), "ours")?;
	repo.add_all()?;
	repo.stash(None)?.unwrap();

	fs::write(path.join("file"), "theirs")?;
	let signature = git2::Signature::now("test", "test@test.test")?;
	repo.repo_mut().stash_save(&signature, "made by hand", None)?;

	let listed = repo.stash_list()?;

	assert_eq!(listed.len(), 2);
	assert!(listed[0].is_foreign, "the newest is the one made by hand");
	assert!(!listed[1].is_foreign);

	Ok(())
}

/// A stash dropped is a stash gone from the list.
#[rstest]
fn a_deleted_stash_leaves_the_list(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "stashed")?;
	repo.add_all()?;
	let stash = repo.stash(None)?.unwrap();

	assert_eq!(repo.stash_list()?.len(), 1);

	repo.stash_delete(stash)?;

	assert!(repo.stash_list()?.is_empty());
	Ok(())
}

/// The plain case: nothing happened while the app was away, so the stash simply comes back.
#[rstest]
fn a_restore_puts_the_stash_back(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "stashed")?;
	repo.add_all()?;
	let stash = repo.stash(None)?.unwrap();

	assert_eq!(fs::read_to_string(path.join("file"))?, "committed");

	let result = repo.stash_restore(stash)?;

	assert!(matches!(result, MergeResult::Ok));
	assert_eq!(fs::read_to_string(path.join("file"))?, "stashed");
	Ok(())
}

/// The whole point. The user wrote the same file again after the restart, so their text is in the
/// index and not in `HEAD`. Merging against `HEAD` calls that text nothing and refuses to write over
/// it; merging against the index makes it a side, and what comes back is a conflict to resolve.
#[rstest]
fn a_restore_over_a_later_edit_is_a_conflict(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "stashed")?;
	repo.add_all()?;
	let stash = repo.stash(None)?.unwrap();

	// The session the stash belonged to is over. The user opens the catalog and writes again — every
	// write reaches the index, which is what makes the index the side to merge with.
	fs::write(path.join("file"), "written after the restart")?;
	repo.add_all()?;

	assert!(repo.stash_apply(stash).is_err(), "against HEAD this cannot be replayed at all");

	let result = repo.stash_restore(stash)?;

	assert!(matches!(result, MergeResult::Conflicts(_)), "expected a conflict, got {result:?}");

	let content = fs::read_to_string(path.join("file"))?;
	assert!(content.contains("written after the restart"), "the later edit is one side: {content}");
	assert!(content.contains("stashed"), "the stash is the other side: {content}");

	Ok(())
}

/// An edit made after the restart to a file the stash never touched is none of the restore's
/// business, and a merge against the index leaves it exactly where it is.
#[rstest]
fn a_restore_leaves_an_unrelated_later_edit_alone(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("stashed"), "committed")?;
	fs::write(path.join("other"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("stashed"), "stashed")?;
	repo.add_all()?;
	let stash = repo.stash(None)?.unwrap();

	fs::write(path.join("other"), "written after the restart")?;
	repo.add_all()?;

	let result = repo.stash_restore(stash)?;

	assert!(matches!(result, MergeResult::Ok));
	assert_eq!(fs::read_to_string(path.join("stashed"))?, "stashed");
	assert_eq!(fs::read_to_string(path.join("other"))?, "written after the restart");

	Ok(())
}

/// `HEAD` moved while the stash waited — the sync that was interrupted had already pulled. The
/// stash still belongs on top of it, and nothing the pull brought is undone.
#[rstest]
fn a_restore_lands_on_a_head_that_moved(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("stashed"), "committed")?;
	fs::write(path.join("pulled"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("stashed"), "stashed")?;
	repo.add_all()?;
	let stash = repo.stash(None)?.unwrap();

	fs::write(path.join("pulled"), "arrived with the pull")?;
	repo.add_all()?;
	repo.commit_debug()?;

	let result = repo.stash_restore(stash)?;

	assert!(matches!(result, MergeResult::Ok));
	assert_eq!(fs::read_to_string(path.join("stashed"))?, "stashed");
	assert_eq!(fs::read_to_string(path.join("pulled"))?, "arrived with the pull");

	Ok(())
}

/// A file that appeared on disk without the index knowing — dropped in from outside, or written
/// while the restore ran. The write that follows is forced, so this refuses and names it rather than
/// overwriting it.
#[rstest]
fn a_restore_refuses_over_a_file_the_index_never_saw(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("new"), "staged, then stashed")?;
	repo.add_all()?;
	let stash = repo.stash(None)?.unwrap();

	assert!(!path.join("new").exists());
	fs::write(path.join("new"), "put here by something else")?;

	let result = repo.stash_restore(stash);

	assert!(result.is_err(), "the file is not the restore's to overwrite");
	assert_eq!(fs::read_to_string(path.join("new"))?, "put here by something else");

	Ok(())
}

/// The same edit through `stash_apply`, which is what an interrupted operation used to reach.
///
/// It merges against `HEAD`, and against `HEAD` the later edit is not a change at all — so the merge
/// is clean and the write is the one thing that could still notice. It did not: `allow_conflicts` is
/// on, so a path the checkout may not touch is skipped rather than refused, and the apply reported
/// success while the stash never reached the disk. The caller then drops the stash.
#[rstest]
fn an_apply_refuses_rather_than_reporting_a_success_it_did_not_have(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "stashed")?;
	repo.add_all()?;
	let stash = repo.stash(None)?.unwrap();

	fs::write(path.join("file"), "written meanwhile")?;
	repo.add_all()?;

	assert!(repo.stash_apply(stash).is_err(), "reporting success without writing loses the stash");
	assert_eq!(fs::read_to_string(path.join("file"))?, "written meanwhile");

	Ok(())
}

/// A stash is signed without asking who is working: recovery takes one while a catalog is being
/// opened, where there are no credentials to ask for. The signature comes from the repository's own
/// config, and the stash is still recognisably ours.
#[rstest]
fn a_stash_signs_itself(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "put aside without credentials")?;
	repo.add_all()?;

	let stash = repo.stash(None)?.unwrap();

	assert_eq!(fs::read_to_string(path.join("file"))?, "committed");

	let listed = repo.stash_list()?;
	assert_eq!(listed.len(), 1);
	assert!(!listed[0].is_foreign, "it is ours, and the next open has to recognise it");

	repo.stash_apply(stash)?;
	assert_eq!(fs::read_to_string(path.join("file"))?, "put aside without credentials");

	Ok(())
}

/// Nothing in the index, nothing to put aside — and no empty stash left in the reflog for the next
/// open to trip over.
#[rstest]
fn a_stash_of_nothing_is_no_stash(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	assert!(repo.stash(None)?.is_none());
	assert!(repo.stash_list()?.is_empty());

	Ok(())
}
