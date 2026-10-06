use test_utils::git::*;
use test_utils::*;

/// An untracked file is not a change to stash, and it is not touched either.
///
/// The stash is built from the index, so a file the index never heard of produces nothing to stash —
/// and, because the reset is scoped to the stashed paths, it stays on disk with its content instead
/// of being carried away and put back.
#[rstest]
fn untracked_file_is_left_alone(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "1")?;

	assert!(repo.stash(None)?.is_none());
	assert_eq!(fs::read_to_string(path.join("file"))?, "1");
	Ok(())
}

/// A file that is staged is stashed, even though it is new — "untracked" means unknown to the index,
/// not absent from `HEAD`.
#[rstest]
fn staged_new_file_is_stashed(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "1")?;
	repo.add("file")?;

	let oid = repo.stash(None)?.unwrap();
	assert!(!path.join("file").exists());

	let apply_result = repo.stash_apply(oid)?;

	assert!(matches!(apply_result, MergeResult::Ok));
	assert_eq!(fs::read_to_string(path.join("file"))?, "1");
	Ok(())
}

#[rstest]
fn stash_without_conflict(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "test\ntest\ntest\ntest\ntest")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "test\n123\n123\ntest\ntest")?;
	repo.add("file")?;

	let oid = repo.stash(None)?.unwrap();
	let apply_result = repo.stash_apply(oid)?;
	assert!(matches!(apply_result, MergeResult::Ok));

	assert_eq!(fs::read_to_string(path.join("file"))?, "test\n123\n123\ntest\ntest");

	Ok(())
}

#[rstest]
fn conflict(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("file");
	fs::write(&file, "content")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(&file, "222")?;
	repo.add("file")?;

	let stash = repo.stash(None)?.unwrap();
	fs::write(&file, "444")?;
	repo.add("file")?;
	repo.commit_debug()?;

	let MergeResult::Conflicts(conflicts) = repo.stash_apply(stash)? else {
		panic!("conflict was expected")
	};

	assert_eq!(conflicts.first().unwrap().ours, Some(PathBuf::from("file")));
	assert_eq!(
		fs::read_to_string(file)?,
		"<<<<<<< Updated upstream\n444\n=======\n222\n>>>>>>> Stashed changes\n"
	);

	Ok(())
}

#[rstest]
fn rename_file(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("file");
	let file_renamed = path.join("file_renamed");
	fs::write(&file, "init content")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::rename(&file, file.with_file_name(&file_renamed))?;
	repo.add_all()?;
	assert!(!file.exists());
	assert!(file_renamed.exists());

	let stash = repo.stash(None)?.unwrap();
	assert!(file.exists());
	assert!(!file_renamed.exists());

	fs::remove_file(&file)?;
	repo.add_all()?;
	repo.commit_debug()?;

	assert!(!file.exists());
	assert!(!file_renamed.exists());

	repo.stash_apply(stash)?;

	assert!(file_renamed.exists());

	assert_eq!(fs::read_to_string(file.with_file_name("file_renamed"))?, "init content");

	Ok(())
}

/// A stash libgit2 made is still applied — by libgit2.
///
/// Not every stash in a repository comes from this code: one taken by an earlier version of Gramax,
/// or by `git stash` in a terminal, sits in the reflog of `refs/stash`. Those are the changes a user
/// put aside before updating, so failing to find them would mean losing them at exactly the wrong
/// moment.
#[rstest]
fn foreign_stash_still_applies(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "stashed by libgit2")?;
	repo.add("file")?;

	let signature = git2::Signature::now("test", "test@test.test")?;
	let oid = repo.repo_mut().stash_save(&signature, "made by libgit2", None)?;

	assert_eq!(fs::read_to_string(path.join("file"))?, "committed");

	let result = repo.stash_apply(oid)?;

	assert!(matches!(result, MergeResult::Ok));
	assert_eq!(fs::read_to_string(path.join("file"))?, "stashed by libgit2");

	repo.stash_delete(oid)?;

	let mut left = 0;
	repo.repo_mut().stash_foreach(|_, _, _| {
		left += 1;
		true
	})?;
	assert_eq!(left, 0);

	Ok(())
}

/// A stash is an ordinary git stash: a commit in the reflog of `refs/stash`.
///
/// Git-native on purpose — `git stash list` shows it and `git stash apply` replays it, so a stash
/// this code wrote is not a thing only this code can read. The reflog is also what keeps it alive:
/// objects nothing points at are what `gc` collects.
#[rstest]
fn stash_is_a_native_stash(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	fs::write(path.join("file"), "content")?;
	let head = repo.repo().head()?.peel_to_commit()?.id();
	repo.add("file")?;

	let stash = repo.stash(None)?.unwrap();

	// Listed where git lists stashes, and shaped the way git shapes them.
	let mut listed = vec![];
	repo.repo_mut().stash_foreach(|_, message, oid| {
		listed.push((*oid, message.to_owned()));
		true
	})?;
	assert_eq!(listed.len(), 1);
	assert_eq!(listed[0].0, stash);

	let git = repo.repo();
	let commit = git.find_commit(stash)?;
	assert_eq!(commit.parent_count(), 2);
	assert_eq!(commit.parent(0)?.id(), head);

	// The branch has not moved, and the stash hangs off `refs/stash` alone.
	assert_eq!(git.head()?.peel_to_commit()?.id(), head);
	assert_eq!(git.find_reference("refs/stash")?.target(), Some(stash));

	Ok(())
}

#[rstest]
fn move_n_modify(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	fs::write(path.join("file"), "test\ntest\ntest")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(path.join("file-moved"), "test\nfff\ntest\ntest\ntest")?;
	repo.add("file")?;
	repo.add("file-moved")?;
	let oid = repo.stash(None)?.unwrap();
	fs::write(path.join("file"), "ffffdsafsdafa\ntest\ntest\ntest\ntest")?;
	repo.add("file")?;
	repo.commit_debug()?;

	assert!(repo.stash_apply(oid).is_ok());

	Ok(())
}

#[rstest]
#[allow(unused)]
fn add_same_file(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	fs::write(path.join("file"), "test\ntest\ntest\ntest\ntest")?;
	repo.add("file")?;
	let oid = repo.stash(None)?.unwrap();

	fs::write(path.join("file"), "fff\nfff\nfff\nttt\nttt")?;
	repo.add("file")?;
	repo.commit_debug()?;

	let res = repo.stash_apply(oid)?;
	let expected = MergeResult::Conflicts(Vec::from([MergeConflictInfo {
		ours: Some("file".into()),
		theirs: Some("file".into()),
		ancestor: None,
	}]));

	assert!(matches!(res, expected));

	assert_eq!(
		fs::read_to_string(path.join("file"))?,
		"<<<<<<< Updated upstream\nfff\nfff\nfff\nttt\nttt\n=======\ntest\ntest\ntest\ntest\ntest\n>>>>>>> Stashed changes\n"
	);

	Ok(())
}

#[rstest]
fn no_stash(_sandbox: TempDir, #[with(&_sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let res = repo.stash(None);
	assert!(matches!(res, Ok(None)));
	Ok(())
}

#[rstest]
fn apply_without_conflicts_adds_to_index(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file1"), "content1")?;
	fs::write(path.join("file2"), "content2")?;
	repo.add("file1")?;
	repo.commit_debug()?;

	fs::write(path.join("file1"), "modified1")?;
	fs::write(path.join("file3"), "new_file")?;
	repo.add("file1")?;
	repo.add("file3")?;

	let oid = repo.stash(None)?.unwrap();

	repo.stash_apply(oid)?;

	let index = repo.repo().index()?;
	assert!(index.get_path(std::path::Path::new("file1"), 0).is_some());
	assert!(index.get_path(std::path::Path::new("file3"), 0).is_some());
	assert_eq!(fs::read_to_string(path.join("file1"))?, "modified1");
	assert_eq!(fs::read_to_string(path.join("file3"))?, "new_file");

	Ok(())
}

#[rstest]
fn apply_with_conflicts_adds_to_index(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "original")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "stashed_version")?;
	repo.add("file")?;

	fs::write(path.join("new_file"), "additional")?;
	fs::write(path.join("new_file_index"), "additional")?;
	repo.add("new_file_index")?;

	let oid = repo.stash(None)?.unwrap();

	fs::write(path.join("file"), "current_version")?;
	repo.add("file")?;
	repo.commit_debug()?;

	let result = repo.stash_apply(oid)?;

	assert!(matches!(result, MergeResult::Conflicts(_)));

	let index = repo.repo().index()?;
	assert!(path.join("file").exists());
	assert!(path.join("new_file").exists());
	assert!(path.join("new_file_index").exists());
	assert!(index.get_path(std::path::Path::new("file"), 0).is_none());
	// `new_file` was never staged, so the stash left it on disk — and the commit made in between
	// stages the whole working copy, which is what put it in the index. It used to be absent here only
	// because the stash had carried the file away for the duration.
	assert!(index.get_path(std::path::Path::new("new_file"), 0).is_some());
	assert!(index.get_path(std::path::Path::new("new_file_index"), 0).is_some());

	Ok(())
}

/// Switching to a branch that changed the same file: the stash is taken, the checkout goes through,
/// and putting the stash back is what reports the conflict.
///
/// This is the shape of the product's "carry my changes to another branch" flow, and each step has to
/// be able to fail on its own — a checkout that refuses here would strand the user on the branch they
/// asked to leave.
#[rstest]
fn checkout_onto_conflicting_branch(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "base")?;
	repo.add("file")?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(path.join("file"), "committed on the branch")?;
	repo.add("file")?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	fs::write(path.join("file"), "edited on master, never published")?;
	repo.add("file")?;

	let oid = repo.stash(None)?.unwrap();
	assert_eq!(fs::read_to_string(path.join("file"))?, "base");

	repo.checkout("other", false)?;
	assert_eq!(fs::read_to_string(path.join("file"))?, "committed on the branch");

	let result = repo.stash_apply(oid)?;
	assert!(matches!(result, MergeResult::Conflicts(_)));

	Ok(())
}

/// A staged deletion is a change like any other: the stash puts the file back, applying removes it.
///
/// The reset and the apply both work off a diff of two trees, and a deletion is the one delta whose
/// path exists on one side only — worth its own case rather than trusting the rename test to cover it.
#[rstest]
fn staged_deletion_travels_through_the_stash(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	fs::write(path.join("kept"), "untouched")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::remove_file(path.join("file"))?;
	repo.add_all()?;

	let oid = repo.stash(None)?.unwrap();

	// Stashing a deletion means the file comes back.
	assert_eq!(fs::read_to_string(path.join("file"))?, "committed");
	assert_eq!(fs::read_to_string(path.join("kept"))?, "untouched");

	let result = repo.stash_apply(oid)?;

	assert!(matches!(result, MergeResult::Ok));
	assert!(!path.join("file").exists());
	assert!(repo.repo().index()?.get_path(std::path::Path::new("file"), 0).is_none());
	assert_eq!(fs::read_to_string(path.join("kept"))?, "untouched");

	Ok(())
}

/// Deleting a stash twice is not a failure the second time.
///
/// The recovery paths can reach the delete more than once, and the lookup this replaced answered
/// "position 0" for a stash it could not find — which dropped a different stash instead.
#[rstest]
fn deleting_a_stash_twice_is_fine(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("first"), "one")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("first"), "edited")?;
	repo.add_all()?;
	let kept = repo.stash(None)?.unwrap();

	fs::write(path.join("first"), "edited again")?;
	repo.add_all()?;
	let dropped = repo.stash(None)?.unwrap();

	repo.stash_delete(dropped)?;
	repo.stash_delete(dropped)?;

	// The other stash is still there — the second delete did not take it.
	let mut left = vec![];
	repo.repo_mut().stash_foreach(|_, _, oid| {
		left.push(*oid);
		true
	})?;

	assert_eq!(left, vec![kept]);

	Ok(())
}

/// After a stash the index describes `HEAD` again — not the state that was put aside.
///
/// Anything that runs next compares against the index: a branch checkout refuses when the index
/// still claims changes that are no longer on disk, so a stash that forgets to update it makes the
/// very next operation fail.
#[rstest]
fn stash_leaves_the_index_at_head(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "edited")?;
	fs::write(path.join("added"), "new")?;
	repo.add_all()?;

	repo.stash(None)?.unwrap();

	let head_tree = repo.repo().head()?.peel_to_commit()?.tree()?.id();
	let index_tree = repo.repo().index()?.write_tree()?;

	assert_eq!(index_tree, head_tree, "the index still differs from HEAD after the stash");
	assert!(!path.join("added").exists());
	assert_eq!(fs::read_to_string(path.join("file"))?, "committed");

	Ok(())
}

/// The untracked files a foreign stash carried come back even when the replay conflicts.
///
/// `git stash --include-untracked` takes untracked files away in a third parent, and applying such a
/// stash has to put them back. A conflict is the case where it matters most: resolving it drops the
/// stash, and anything still inside the stash goes with it.
#[rstest]
fn untracked_files_of_a_foreign_stash_survive_a_conflict(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "stashed")?;
	repo.add("file")?;
	fs::write(path.join("untracked"), "never committed")?;

	let signature = git2::Signature::now("test", "test@test.test")?;
	let oid = repo
		.repo_mut()
		.stash_save(&signature, "made by git stash -u", Some(git2::StashFlags::INCLUDE_UNTRACKED))?;

	assert!(!path.join("untracked").exists());

	// The same file, changed differently on `HEAD`: the stash cannot be replayed cleanly.
	fs::write(path.join("file"), "changed upstream")?;
	repo.add("file")?;
	repo.commit_debug()?;

	let result = repo.stash_apply(oid)?;

	assert!(matches!(result, MergeResult::Conflicts(_)));
	assert_eq!(fs::read_to_string(path.join("untracked"))?, "never committed");

	Ok(())
}

/// A conflict on one path does not cost an edit made on another while the apply ran.
///
/// The replay is one forced checkout, because a conflict marker never merges cleanly with what is on
/// disk — and forcing writes the non-conflicted paths too. So a file written at one of them while
/// the operation ran would be replaced by the stashed content, losing an edit because something
/// *else* conflicted. The apply refuses instead, exactly as `git stash apply` does, and refuses
/// before writing anything.
#[rstest]
fn a_conflict_does_not_overwrite_a_file_edited_meanwhile(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("a"), "base")?;
	fs::write(path.join("b"), "base")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("a"), "stashed a")?;
	fs::write(path.join("b"), "stashed b")?;
	repo.add_all()?;
	let stash = repo.stash(None)?.unwrap();

	// `a` moves under the stash's feet, so the replay cannot be clean.
	fs::write(path.join("a"), "upstream a")?;
	repo.add_all()?;
	repo.commit_debug()?;

	// `b` is written while the operation is in flight, and nothing conflicts on it.
	fs::write(path.join("b"), "written during the sync")?;

	let result = repo.stash_apply(stash);

	assert!(result.is_err(), "the apply must refuse rather than write over `b`");
	assert_eq!(fs::read_to_string(path.join("b"))?, "written during the sync");
	assert_eq!(fs::read_to_string(path.join("a"))?, "upstream a", "nothing is written when it refuses");

	Ok(())
}

/// An apply that cannot write must say so, not report a success it did not have.
///
/// A safe checkout with `allow_conflicts` on does not refuse a path it may not touch — it skips it.
/// The merge here is clean, so nothing else notices, and the apply used to return `Ok` while the
/// stash's content never reached the disk. The caller then drops the stash, and the change is gone
/// with no error anywhere.
///
/// The path is blocked by a staged edit, which is the shape this takes in the app: every write goes
/// into the index, so an edit made while the operation was running is staged by the time the stash
/// comes back.
#[rstest]
fn an_apply_refuses_rather_than_reporting_a_success_it_did_not_have(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "stashed")?;
	repo.add_all()?;
	let stash = repo.stash(None)?.unwrap();

	fs::write(path.join("file"), "written while the operation ran")?;
	repo.add_all()?;

	assert!(repo.stash_apply(stash).is_err(), "reporting success without writing loses the stash");
	assert_eq!(fs::read_to_string(path.join("file"))?, "written while the operation ran");

	Ok(())
}
