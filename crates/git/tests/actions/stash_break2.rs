//! Second round: nail down the exact state each divergence leaves behind.

use gramaxgit::actions::merge::Merge;
use test_utils::git::*;
use test_utils::*;

fn status_of(repo: &Repo<TestCreds>, name: &str) -> String {
	let statuses = repo.repo().statuses(None).unwrap();
	statuses
		.iter()
		.find(|e| e.path() == Some(name))
		.map(|e| format!("{:?}", e.status()))
		.unwrap_or_else(|| "clean".to_string())
}

/// An ignored file standing where an incoming commit writes is overwritten by the merge, and the
/// index follows. Same as `git` — ignored files are expendable to a checkout — so this is coverage,
/// not a finding: the safe checkout does not get stuck on it and does not leave a stale file behind.
#[rstest]
fn ignored_file_is_overwritten_by_the_incoming_change(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("build.log");

	fs::write(path.join(".gitignore"), "*.log\n")?;
	repo.add(".gitignore")?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(&file, "from server")?;
	repo.add("build.log")?;
	let (theirs, _) = repo.commit_debug()?;

	repo.checkout("master", false)?;
	fs::write(&file, "my local log")?;

	let merged = repo.merge(MergeOptions::theirs("other"))?;
	assert!(!merged.has_conflicts());

	let head = repo.repo().head()?.peel_to_commit()?.id();
	info!("head after merge: {head}, theirs: {theirs}, status: {}", status_of(&repo, "build.log"));

	assert_eq!(
		fs::read_to_string(&file)?,
		"from server",
		"HEAD is now {head} (theirs {theirs}); the working copy still says: git status = {}",
		status_of(&repo, "build.log")
	);
	Ok(())
}

/// Applying a stash that conflicts checks out the whole merged index, forced and unscoped. Anything
/// the working copy held at an unrelated path goes with it.
#[rstest]
fn conflicting_apply_keeps_unrelated_workdir_edits(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("conflicting"), "base")?;
	fs::write(path.join("unrelated"), "base")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("conflicting"), "mine")?;
	repo.add("conflicting")?;
	let oid = repo.stash(None)?.expect("something to stash");

	fs::write(path.join("conflicting"), "theirs")?;
	repo.add("conflicting")?;
	repo.commit_debug()?;

	// Typed after the pull, never staged.
	fs::write(path.join("unrelated"), "typed while the sync ran")?;

	let result = repo.stash_apply(oid)?;
	assert!(result.has_conflicts());
	assert_eq!(
		fs::read_to_string(path.join("unrelated"))?,
		"typed while the sync ran",
		"resolving a conflict on one file must not roll another one back"
	);
	Ok(())
}

/// The catalog shape Gramax itself produces: an article becomes a folder with `_index.md`.
#[rstest]
fn file_becomes_directory(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("article.md"), "the article")?;
	repo.add("article.md")?;
	repo.commit_debug()?;

	fs::remove_file(path.join("article.md"))?;
	fs::create_dir(path.join("article"))?;
	fs::write(path.join("article/_index.md"), "the article")?;
	fs::write(path.join("article/child.md"), "a child")?;
	repo.add_all()?;

	let oid = repo.stash(None)?.expect("something to stash");
	assert!(path.join("article.md").exists(), "the stash must bring the article file back");
	assert!(!path.join("article/_index.md").exists(), "and take the folder away");

	repo.stash_apply(oid)?;
	assert_eq!(fs::read_to_string(path.join("article/_index.md"))?, "the article");
	assert_eq!(fs::read_to_string(path.join("article/child.md"))?, "a child");
	assert!(!path.join("article.md").exists());
	Ok(())
}

#[rstest]
fn directory_becomes_file(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::create_dir(path.join("article"))?;
	fs::write(path.join("article/_index.md"), "the article")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::remove_dir_all(path.join("article"))?;
	fs::write(path.join("article.md"), "the article")?;
	repo.add_all()?;

	let oid = repo.stash(None)?.expect("something to stash");
	assert_eq!(fs::read_to_string(path.join("article/_index.md"))?, "the article");
	assert!(!path.join("article.md").exists());

	repo.stash_apply(oid)?;
	assert_eq!(fs::read_to_string(path.join("article.md"))?, "the article");
	assert!(!path.join("article/_index.md").exists());
	Ok(())
}

/// A new article in a new folder, stashed: the folder must not be left behind empty, or the catalog
/// tree shows a section with nothing in it.
#[rstest]
fn stash_of_a_new_folder_leaves_no_empty_directory(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("seed"), "seed")?;
	repo.add("seed")?;
	repo.commit_debug()?;

	fs::create_dir(path.join("section"))?;
	fs::write(path.join("section/_index.md"), "new section")?;
	repo.add_all()?;

	repo.stash(None)?.expect("something to stash");
	assert!(!path.join("section/_index.md").exists());
	assert!(!path.join("section").exists(), "the folder the stash emptied must be gone too");
	Ok(())
}

/// What the repository looks like after that merge, in `git`'s own words — and what `git merge`
/// would have done with the same setup.
#[rstest]
fn ignored_file_merge_leaves_index_and_disk_disagreeing(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	use std::process::Command;
	let path = sandbox.path();
	let file = path.join("build.log");

	let git = |args: &[&str]| -> String {
		let out = Command::new("git").args(args).current_dir(path).output().unwrap();
		String::from_utf8_lossy(&out.stdout).to_string() + &String::from_utf8_lossy(&out.stderr)
	};

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

	repo.merge(MergeOptions::theirs("other"))?;

	let head_has_it = repo.repo().head()?.peel_to_commit()?.tree()?.get_path(Path::new("build.log")).is_ok();
	let index_has_it = repo.repo().index()?.get_path(Path::new("build.log"), 0).is_some();
	let porcelain = git(&["status", "--porcelain"]);

	assert!(
		!head_has_it || index_has_it,
		"HEAD carries build.log but the index does not, so the next commit records it as deleted. \
		 disk = {:?}; git status --porcelain = {porcelain:?}",
		fs::read_to_string(&file)?
	);
	Ok(())
}

// ---------------------------------------------------------------------------
// Reference behaviour of the real `git` binary, for the two cases above
// ---------------------------------------------------------------------------

fn git_cli(dir: &Path, args: &[&str]) -> String {
	let out = std::process::Command::new("git")
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

/// `git stash apply` refuses to land on an untracked file — the reference for
/// `stash_apply_does_not_eat_an_untracked_file`.
#[rstest]
fn reference_git_stash_apply_refuses_over_untracked(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("seed"), "seed")?;
	repo.add("seed")?;
	repo.commit_debug()?;

	fs::write(path.join("new.md"), "stashed content")?;
	git_cli(path, &["stash", "push", "--include-untracked", "-m", "ref"]);
	assert!(!path.join("new.md").exists());

	fs::write(path.join("new.md"), "written again by hand")?;
	let out = git_cli(path, &["stash", "apply"]);

	assert_eq!(
		fs::read_to_string(path.join("new.md"))?,
		"written again by hand",
		"reference git leaves the untracked file alone; it said: {out}"
	);
	Ok(())
}

/// `git merge` also refuses when an untracked file is in the way — so the refusal itself matches
/// git. What changed is that the stash no longer moves such a file out of the way beforehand.
#[rstest]
fn reference_git_merge_refuses_over_untracked(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("seed"), "seed")?;
	repo.add("seed")?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(path.join("new.md"), "from server")?;
	repo.add("new.md")?;
	repo.commit_debug()?;
	repo.checkout("master", false)?;

	fs::write(path.join("new.md"), "my untracked work")?;
	let out = git_cli(path, &["merge", "other"]);

	assert!(out.contains("untracked working tree files would be overwritten"), "git said: {out}");
	Ok(())
}

/// `core.autocrlf` is set by `ensure_crlf_configured` on every add. The stash writes its tree from
/// the index (LF) and then checks it out through the filter (CRLF), so a round trip has to land on
/// the same bytes it started from — otherwise the file stays "modified" forever after a sync.
#[rstest]
fn crlf_roundtrip(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("file.md");

	repo.repo().config()?.set_str("core.autocrlf", "true")?;

	fs::write(&file, "line1\r\nline2\r\n")?;
	repo.add("file.md")?;
	repo.commit_debug()?;

	fs::write(&file, "line1\r\nCHANGED\r\n")?;
	repo.add("file.md")?;

	let oid = repo.stash(None)?.expect("something to stash");
	assert_eq!(fs::read_to_string(&file)?, "line1\r\nline2\r\n", "the reset must produce CRLF again");

	repo.stash_apply(oid)?;
	assert_eq!(fs::read_to_string(&file)?, "line1\r\nCHANGED\r\n", "and so must the apply");

	let dirty = repo.repo().statuses(None)?.iter().filter(|e| e.path() == Some("file.md")).count();
	assert_eq!(dirty, 1, "exactly the one staged change, no phantom line-ending diff");
	Ok(())
}

/// A repository holding both a libgit2 stash and one of ours: the list, the addressing by oid and
/// the drop must all stay consistent.
#[rstest]
fn mixed_stash_sources_stay_addressable(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("a"), "a1")?;
	fs::write(path.join("b"), "b1")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("a"), "a2")?;
	repo.add("a")?;
	let signature = git2::Signature::now("test", "test@test.test")?;
	let libgit2_stash = repo.repo_mut().stash_save(&signature, "by libgit2", None)?;

	fs::write(path.join("b"), "b2")?;
	repo.add("b")?;
	let ours = repo.stash(None)?.expect("something to stash");

	let mut listed = vec![];
	repo.repo_mut().stash_foreach(|_, _, oid| {
		listed.push(*oid);
		true
	})?;
	assert_eq!(listed, vec![ours, libgit2_stash]);

	repo.stash_delete(ours)?;
	repo.stash_apply(libgit2_stash)?;
	assert_eq!(fs::read_to_string(path.join("a"))?, "a2");

	let mut left = vec![];
	repo.repo_mut().stash_foreach(|_, _, oid| {
		left.push(*oid);
		true
	})?;
	assert_eq!(left, vec![libgit2_stash]);
	Ok(())
}

/// Dropping the newest stash, rather than the oldest.
#[rstest]
fn dropping_the_newest_stash(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("a"), "a1")?;
	fs::write(path.join("b"), "b1")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("a"), "a2")?;
	repo.add("a")?;
	let first = repo.stash(None)?.expect("first");

	fs::write(path.join("b"), "b2")?;
	repo.add("b")?;
	let second = repo.stash(None)?.expect("second");

	repo.stash_delete(second)?;
	assert_eq!(repo.repo().find_reference("refs/stash")?.target(), Some(first), "refs/stash must point at what is left");

	repo.stash_apply(first)?;
	assert_eq!(fs::read_to_string(path.join("a"))?, "a2");
	Ok(())
}

// ---------------------------------------------------------------------------
// The sync sequence itself: stash -> pull -> (recover | apply stash)
// ---------------------------------------------------------------------------

/// `WorkdirRepository._pull`, in the order it runs: take a stash, pull, and on failure reset hard to
/// where `HEAD` was and put the stash back.
fn sync(repo: &mut Repo<TestCreds>, theirs: &str) -> Result<()> {
	use gramaxgit::actions::reset::*;

	let before = repo.repo().head()?.peel_to_commit()?.id();
	let stash = repo.stash(None)?;

	match repo.merge(MergeOptions::theirs(theirs)) {
		Ok(_) => {
			if let Some(oid) = stash {
				repo.stash_apply(oid)?;
			}
			Ok(())
		}
		Err(e) => {
			// Mirrors `WorkdirRepository._pull`: the hard reset undoes a merge that got halfway, so it
			// only runs when the merge got anywhere. A refusal leaves HEAD where it was — resetting then
			// would discard the working copy over a pull that never happened.
			let after = repo.repo().head()?.peel_to_commit()?.id();
			if after != before {
				repo.reset(ResetOptions { mode: ResetMode::Hard, head: Some(OidInfo(before.to_string())) })?;
			}

			if let Some(oid) = stash {
				repo.stash_apply(oid)?;
			}
			Err(e)
		}
	}
}

/// A whole sync over an edit that never reached the index. Nothing calls `gvc.add()` on web
/// (`core/extensions/git/core/Repository/Repository.ts`: `if (!isWeb) await this.gvc.add()`), so this
/// is the state the browser build syncs in whenever the file-provider event behind an edit did not
/// stage it — while staging is paused, or after the `add` that `_gitIndexAddFiles` swallows.
#[rstest]
fn sync_preserves_an_edit_that_never_reached_the_index(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("file");

	fs::write(&file, "base\n")?;
	repo.add("file")?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(&file, "from server\n")?;
	repo.add("file")?;
	repo.commit_debug()?;
	repo.checkout("master", false)?;

	fs::write(&file, "my unsaved work\n")?;

	let synced = sync(&mut repo, "other");

	assert!(
		fs::read_to_string(&file)?.contains("my unsaved work"),
		"the edit is gone after a sync that ended with {synced:?}; on disk: {:?}",
		fs::read_to_string(&file)?
	);
	Ok(())
}

/// A whole sync where the server adds a file the user already has, untracked. The old stash carried
/// untracked files away, so the pull never met one; this one leaves them in place.
#[rstest]
fn sync_survives_an_untracked_file_the_server_also_adds(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();
	let file = path.join("new.md");

	fs::write(path.join("seed"), "seed")?;
	repo.add("seed")?;
	repo.commit_debug()?;

	repo.new_branch("other")?;
	repo.checkout("other", false)?;
	fs::write(&file, "from server")?;
	repo.add("new.md")?;
	let (theirs, _) = repo.commit_debug()?;
	repo.checkout("master", false)?;

	fs::write(&file, "my untracked work")?;

	let synced = sync(&mut repo, "other");

	// The pull refuses, exactly as `git merge` does over an untracked file it would have to overwrite.
	// What the rewrite owes the user here is the file itself and a message that names it — the old
	// behaviour carried the file into the stash and let the pull through, which is convenient right up
	// until the stash cannot be replayed.
	let error = synced.expect_err("a pull that would overwrite an untracked file must refuse");
	assert!(error.to_string().contains("new.md"), "the error has to name the file: {error}");
	assert_eq!(fs::read_to_string(&file)?, "my untracked work", "and the file has to survive it");
	assert_ne!(repo.repo().head()?.peel_to_commit()?.id(), theirs, "the pull did not land");
	Ok(())
}

/// The same, with the edit staged — which is what the file-provider events do on every write. If
/// this fails too, the defect is not about staging and reaches every platform.
#[rstest]
fn conflicting_apply_keeps_unrelated_staged_edits(sandbox: TempDir, #[with(&sandbox)] mut repo: Repo<TestCreds>) -> Result {
	let path = sandbox.path();

	fs::write(path.join("conflicting"), "base")?;
	fs::write(path.join("unrelated"), "base")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(path.join("conflicting"), "mine")?;
	repo.add("conflicting")?;
	let oid = repo.stash(None)?.expect("something to stash");

	fs::write(path.join("conflicting"), "theirs")?;
	repo.add("conflicting")?;
	repo.commit_debug()?;

	fs::write(path.join("unrelated"), "typed while the sync ran")?;
	repo.add("unrelated")?;

	assert!(repo.stash_apply(oid)?.has_conflicts());
	assert_eq!(fs::read_to_string(path.join("unrelated"))?, "typed while the sync ran");
	Ok(())
}
