//! What the "assume unchanged" bit does to the questions Gramax asks git.
//!
//! In the browser every `lstat` lies: WASMFS builds the inode from a pointer and the mtime from the
//! moment the file object was constructed, and neither survives a page reload. Nothing an index
//! recorded ever matches again, so git treats every file as possibly-modified and reads it whole to
//! find out. Measured on a catalog of 3458 files, that turns a publish of one edit from 1,7 s into
//! 9,6 s, and a checkout from 2,6 s into 9,3 s.
//!
//! `GIT_INDEX_ENTRY_VALID` is git's own answer: libgit2 checks it *before* comparing any metadata
//! (`diff_generate.c:167` and `:840`), so the lie is never consulted. These tests pin what the bit
//! does and — more importantly — what it must not do.

use test_utils::git::*;
use test_utils::*;

/// Without the bit, a change made behind the index is seen. This is the behaviour on desktop, where
/// the working copy has writers other than Gramax, and it must stay.
#[rstest]
fn a_change_made_behind_the_index_is_seen(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(path.join("file"), "changed behind git's back")?;

	let status = repo.status(false)?.short_info()?;
	assert_eq!(
		status.entries().iter().find(|e| e.path == Path::new("file")).map(|e| e.status),
		Some(StatusEntry::Modified)
	);

	Ok(())
}

/// With the bit, the same change is not seen — which is the whole point, and the whole risk.
///
/// It is only correct where Gramax is the only writer: in the browser, where OPFS is private to the
/// origin. Everything Gramax writes goes into the index as it is written, so a change it made is
/// never behind the index in the first place.
#[rstest]
fn a_marked_entry_hides_a_change_made_behind_the_index(
	sandbox: TempDir,
	#[with(&sandbox)] repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;

	assert_eq!(repo.assume_unchanged_all()?, 1);

	fs::write(path.join("file"), "changed behind git's back")?;

	let status = repo.status(false)?.short_info()?;
	assert!(
		status.entries().iter().all(|e| e.path != Path::new("file")),
		"a marked entry must not be reported as modified"
	);

	Ok(())
}

/// Staging clears the mark, so a change Gramax made is visible again straight away.
///
/// This is what makes the scheme safe rather than merely fast: `add_path` writes a fresh entry, and
/// a fresh entry has no flags. Without it a marked file would stay invisible forever.
#[rstest]
fn staging_a_marked_file_makes_it_visible_again(
	sandbox: TempDir,
	#[with(&sandbox)] repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;
	repo.assume_unchanged_all()?;

	fs::write(path.join("file"), "edited by the app")?;
	repo.add("file")?;

	let status = repo.status(true)?.short_info()?;
	assert_eq!(
		status.entries().iter().find(|e| e.path == Path::new("file")).map(|e| e.status),
		Some(StatusEntry::Modified),
		"staging must clear the mark, or the edit never reaches a commit"
	);

	Ok(())
}

/// A commit taken after marking carries what was staged, byte for byte.
///
/// The bit tells git not to look at the working copy; it must not tell it to commit stale content.
#[rstest]
fn a_commit_after_marking_carries_what_was_staged(
	sandbox: TempDir,
	#[with(&sandbox)] repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "first")?;
	repo.add("file")?;
	repo.commit_debug()?;
	repo.assume_unchanged_all()?;

	fs::write(path.join("file"), "second")?;
	repo.add("file")?;
	repo.commit_debug()?;

	let head_tree = repo.repo().head()?.peel_to_commit()?.tree()?;
	let entry = head_tree.get_path(Path::new("file"))?;
	let blob = repo.repo().find_blob(entry.id())?;

	assert_eq!(String::from_utf8_lossy(blob.content()), "second");

	Ok(())
}

/// An incoming change still lands on a marked file.
///
/// Marking says "the working copy holds what the index says"; it must not stop a checkout from
/// writing something new over it, or a pull would silently do nothing.
#[rstest]
fn an_incoming_change_still_lands_on_a_marked_file(
	sandbox: TempDir,
	#[with(&sandbox)] mut repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "first")?;
	repo.add("file")?;
	repo.commit_debug()?;

	repo.new_branch("incoming")?;
	repo.checkout("incoming", false)?;
	fs::write(path.join("file"), "from the other branch")?;
	repo.add("file")?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	assert_eq!(fs::read_to_string(path.join("file"))?, "first");

	repo.assume_unchanged_all()?;
	repo.checkout("incoming", false)?;

	assert_eq!(
		fs::read_to_string(path.join("file"))?,
		"from the other branch",
		"a checkout must still write what it brings"
	);

	Ok(())
}

/// The stash still carries a staged change when the rest of the index is marked.
///
/// The stash is built from the index, and staging clears the mark on what it touches — so the
/// stashed path is unmarked by construction. This pins that the two do not interfere.
#[rstest]
fn a_marked_index_still_stashes_what_was_staged(
	sandbox: TempDir,
	#[with(&sandbox)] mut repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	fs::write(path.join("other"), "untouched")?;
	repo.add_all()?;
	repo.commit_debug()?;
	repo.assume_unchanged_all()?;

	fs::write(path.join("file"), "edited and stashed")?;
	repo.add("file")?;

	let stash = repo.stash(None)?.expect("something to stash");
	assert_eq!(fs::read_to_string(path.join("file"))?, "committed", "the stash takes the edit away");

	repo.stash_apply(stash)?;
	assert_eq!(fs::read_to_string(path.join("file"))?, "edited and stashed", "and puts it back");

	Ok(())
}

/// The mark is written to `.git/index` and is still there when the file is read again.
///
/// This is the whole point: a page reload throws away every stat WASMFS invented, and the index is
/// the only thing that survives it. A mark that lived in memory would be gone exactly when it is
/// needed.
#[rstest]
fn the_mark_survives_reading_the_index_again(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;
	assert_eq!(repo.assume_unchanged_all()?, 1);

	// Straight from disk, through a repository handle that never saw the marking.
	let reopened = git2::Repository::open(path)?;
	let index = reopened.index()?;
	let entry = index.get_path(Path::new("file"), 0).expect("the entry is in the index");

	assert_ne!(entry.flags & 0x8000, 0, "the assume-unchanged bit must be in the file on disk");

	// And a second marking finds nothing left to do.
	assert_eq!(repo.assume_unchanged_all()?, 0);

	Ok(())
}

/// Deleting a file through the app stages the deletion, so no marked entry is left behind.
///
/// A mark says "the working copy holds what the index says". If a file were deleted while its entry
/// stayed marked, that claim would be false and git would never look — the deletion would be
/// invisible. It cannot happen through the app: a delete goes through `add`, which removes the entry
/// with it.
#[rstest]
fn deleting_through_the_app_leaves_no_marked_entry(
	sandbox: TempDir,
	#[with(&sandbox)] repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add_all()?;
	repo.commit_debug()?;
	repo.assume_unchanged_all()?;

	fs::remove_file(path.join("file"))?;
	repo.add_glob_force(vec!["file"])?;

	let index = repo.repo().index()?;
	assert!(index.get_path(Path::new("file"), 0).is_none(), "the entry goes with the file");

	let status = repo.status(true)?.short_info()?;
	assert_eq!(
		status.entries().iter().find(|e| e.path == Path::new("file")).map(|e| e.status),
		Some(StatusEntry::Delete),
		"the deletion has to be staged, or it never reaches a commit"
	);

	Ok(())
}

/// Conflicted entries are left alone.
///
/// Their sides live in stages 1-3 and say what each branch had, not what is on disk — marking one
/// would claim something about the working copy that no side of a conflict is entitled to claim.
#[rstest]
fn marking_leaves_conflicted_entries_alone(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "base")?;
	fs::write(path.join("calm"), "same on both sides")?;
	repo.add_all()?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(path.join("file"), "theirs")?;
	repo.add("file")?;
	repo.commit_debug()?;

	repo.checkout("master", false)?;
	fs::write(path.join("file"), "ours")?;
	repo.add("file")?;
	repo.commit_debug()?;

	let _ = repo.merge(MergeOptions::theirs("other"))?;
	assert!(repo.repo().index()?.has_conflicts(), "the merge has to leave a conflict to test");

	let marked = repo.assume_unchanged_all()?;

	let index = repo.repo().index()?;
	for entry in index.iter() {
		if entry.flags & 0x3000 != 0 {
			assert_eq!(entry.flags & 0x8000, 0, "a conflict side must not be marked");
		}
	}

	assert!(marked > 0, "the entries that are not in conflict are still marked");

	Ok(())
}

/// Off everywhere but the browser.
///
/// The mark claims the working copy holds what the index says. On desktop that is not ours to claim:
/// VS Code, a terminal and a file manager write into the same folder, and a stale index would hide
/// the user's own edits.
#[cfg(not(target_arch = "wasm32"))]
#[rstest]
fn a_native_build_marks_nothing(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("file"), "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;

	assert_eq!(repo.assume_unchanged_if_sole_writer()?, 0);

	fs::write(path.join("file"), "changed behind git's back")?;
	let status = repo.status(false)?.short_info()?;
	assert_eq!(
		status.entries().iter().find(|e| e.path == Path::new("file")).map(|e| e.status),
		Some(StatusEntry::Modified),
		"desktop must keep seeing what the working copy actually holds"
	);

	Ok(())
}

/// A staged change stays in the list of changes after marking — this is the one that loses data.
///
/// libgit2 drops the delta for a marked entry outright when the path exists on one side only
/// (`diff_generate.c`, `diff_delta__from_one`), and the `HEAD`-to-index diff goes through that same
/// code. Mark a file the user has staged but not published and it vanishes from the changes the app
/// lists — and what is not listed is never committed.
#[rstest]
fn marking_leaves_staged_changes_visible(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("committed"), "already published")?;
	repo.add_all()?;
	repo.commit_debug()?;

	// The two shapes the app produces: a new article, and an edit of one that exists.
	fs::write(path.join("added"), "written and staged, never published")?;
	fs::write(path.join("committed"), "edited and staged, never published")?;
	repo.add_all()?;

	repo.assume_unchanged_all()?;

	let status = repo.status(true)?.short_info()?;
	let listed = |name: &str| status.entries().iter().any(|e| e.path == Path::new(name));

	assert!(listed("added"), "a staged new file must stay in the changes");
	assert!(listed("committed"), "a staged edit must stay in the changes");

	// And it still reaches a commit with its content intact.
	repo.commit_debug()?;
	let tree = repo.repo().head()?.peel_to_commit()?.tree()?;
	let added = repo.repo().find_blob(tree.get_path(Path::new("added"))?.id())?;
	assert_eq!(String::from_utf8_lossy(added.content()), "written and staged, never published");

	let edited = repo.repo().find_blob(tree.get_path(Path::new("committed"))?.id())?;
	assert_eq!(String::from_utf8_lossy(edited.content()), "edited and staged, never published");

	Ok(())
}

/// A staged deletion is still a change, and marking must not swallow it.
///
/// The path is in `HEAD` and gone from the index, so the delta comes from the one-sided branch of
/// `diff_delta__from_one` — the same one the bit short-circuits.
#[rstest]
fn marking_leaves_a_staged_deletion_visible(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("doomed"), "published once")?;
	fs::write(path.join("kept"), "stays")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::remove_file(path.join("doomed"))?;
	repo.add_glob_force(vec!["doomed"])?;

	repo.assume_unchanged_all()?;

	let status = repo.status(true)?.short_info()?;
	assert_eq!(
		status.entries().iter().find(|e| e.path == Path::new("doomed")).map(|e| e.status),
		Some(StatusEntry::Delete),
		"the deletion has to survive the marking"
	);

	repo.commit_debug()?;
	let tree = repo.repo().head()?.peel_to_commit()?.tree()?;
	assert!(tree.get_path(Path::new("doomed")).is_err(), "and reach the commit");

	Ok(())
}

/// A staged rename keeps both of its ends visible.
///
/// The old path leaves the index and the new one arrives, so both sides are one-sided deltas. Marking
/// either would leave the rename half-published.
#[rstest]
fn marking_leaves_a_staged_rename_visible(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("before"), "content that moves")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::rename(path.join("before"), path.join("after"))?;
	repo.add_glob_force(vec!["before", "after"])?;

	repo.assume_unchanged_all()?;

	let status = repo.status(true)?.short_info()?;
	let seen = |name: &str| status.entries().iter().any(|e| e.path == Path::new(name));
	assert!(seen("before") || seen("after"), "the rename has to stay in the changes");

	repo.commit_debug()?;
	let tree = repo.repo().head()?.peel_to_commit()?.tree()?;
	assert!(tree.get_path(Path::new("after")).is_ok(), "the new name is committed");
	assert!(tree.get_path(Path::new("before")).is_err(), "the old one is gone");

	Ok(())
}

/// The mark outlives the repository handle the cache was holding.
///
/// `cache.rs` keeps a `git2::Repository` alive between commands, so most operations never reopen
/// anything. The mark must not depend on that: a handle is dropped when the generation moves or the
/// cache is reset, and in the browser the whole instance goes away on every page load. Reading the
/// index again has to bring the mark back with it.
#[rstest]
fn the_mark_outlives_the_cached_repository(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path().to_path_buf();

	fs::write(path.join("file"), "committed")?;
	repo.add("file")?;
	repo.commit_debug()?;
	repo.assume_unchanged_all()?;
	drop(repo);

	// Everything the process was holding goes; the next call opens the repository from disk.
	gramaxgit::commands::reset_repo();

	fs::write(path.join("file"), "changed behind git's back")?;

	let hidden = Repo::<TestCreds>::run_read(&path, TestCreds, |repo| {
		Ok(repo.status(false)?.short_info()?.entries().iter().all(|e| e.path != Path::new("file")))
	})
	.expect("reading through a reopened repository");

	assert!(hidden, "a reopened repository has to read the mark back out of the index");

	Ok(())
}

/// A soft reset takes the marks off, because it moves `HEAD` and leaves the index where it was.
///
/// This is the publish whose push failed: the article is committed, so `HEAD` and the index agree
/// and the entry gets marked; then the rollback moves `HEAD` back to the parent and the article is
/// in the index alone. A marked one-sided entry has its delta dropped whole — the article would
/// disappear from the changes and never be published again.
#[rstest]
fn a_soft_reset_takes_the_marks_off(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("old"), "published earlier")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("article"), "written, staged and committed")?;
	repo.add("article")?;
	repo.commit_debug()?;

	// The state the rollback starts from: everything agrees, so everything is markable.
	assert!(repo.assume_unchanged_all()? > 0);

	let parent = repo.repo().head()?.peel_to_commit()?.parent(0)?.id();
	repo.reset(ResetOptions { mode: ResetMode::Soft, head: Some(OidInfo(parent.to_string())) })?;

	let status = repo.status(true)?.short_info()?;
	assert_eq!(
		status.entries().iter().find(|e| e.path == Path::new("article")).map(|e| e.status),
		Some(StatusEntry::New),
		"the article has to stay in the changes after the rollback"
	);

	repo.commit_debug()?;
	let tree = repo.repo().head()?.peel_to_commit()?.tree()?;
	assert!(tree.get_path(Path::new("article")).is_ok(), "and reach the next commit");

	Ok(())
}

/// A mark that has nothing to do costs a walk over the flags and nothing else.
///
/// This is the usual call: the mark is put on before every write, so by the second one everything
/// that may carry it already does. Both the `HEAD`-to-index diff and the index write are skipped —
/// which is what makes it affordable to keep the call before every operation instead of once per
/// session. See [`a_checkout_takes_the_mark_off_what_it_rewrote`] for why once per session is not
/// enough.
#[rstest]
fn a_mark_with_nothing_to_do_does_not_rewrite_the_index(
	sandbox: TempDir,
	#[with(&sandbox)] repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	for i in 0..20 {
		fs::write(path.join(format!("a{i}")), format!("first {i}"))?;
		repo.add(&format!("a{i}"))?;
	}
	repo.commit_debug()?;

	assert_eq!(repo.assume_unchanged_all()?, 20);

	let index_file = path.join(".git").join("index");
	let written_at = fs::metadata(&index_file)?.modified()?;

	assert_eq!(repo.assume_unchanged_all()?, 0);
	assert_eq!(
		fs::metadata(&index_file)?.modified()?,
		written_at,
		"a mark with nothing to do must leave the index file alone"
	);

	Ok(())
}

/// A checkout takes the mark off every entry it rewrites — which is why the mark goes on before
/// every write and not once when the repository is opened.
///
/// The entries a checkout updates are built anew from the tree it brings, and a fresh entry carries
/// no flags. Marked once per session, a catalog would come out of a sync with as many unmarked
/// entries as the sync brought files, and the next command would read every one of them off disk —
/// the very cost the bit exists to remove.
#[rstest]
fn a_checkout_takes_the_mark_off_what_it_rewrote(
	sandbox: TempDir,
	#[with(&sandbox)] mut repo: Repo<TestCreds>,
) -> Result {
	let path = sandbox.path();

	for i in 0..30 {
		fs::write(path.join(format!("a{i}")), format!("first {i}"))?;
		repo.add(&format!("a{i}"))?;
	}
	repo.commit_debug()?;

	repo.new_branch("incoming")?;
	repo.checkout("incoming", false)?;
	for i in 0..10 {
		fs::write(path.join(format!("a{i}")), format!("second {i}"))?;
		repo.add(&format!("a{i}"))?;
	}
	repo.commit_debug()?;
	repo.checkout("master", false)?;

	assert_eq!(repo.assume_unchanged_all()?, 30);

	repo.checkout("incoming", false)?;

	assert_eq!(
		repo.assume_unchanged_all()?,
		10,
		"the ten files the checkout rewrote must have lost the mark and got it back"
	);

	Ok(())
}
