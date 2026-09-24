use gramaxgit::ext::history::PathFollower;
use gramaxgit::git2::{Commit, Repository};
use gramaxgit::prelude::*;

use std::fs;

use test_utils::git::*;
use test_utils::*;

fn write(sandbox: &TempDir, path: &str, content: &str) -> Result {
	let path = sandbox.path().join(path);
	if let Some(parent) = path.parent() {
		fs::create_dir_all(parent)?;
	}
	fs::write(path, content)?;
	Ok(())
}

fn mv(sandbox: &TempDir, from: &str, to: &str) -> Result {
	let content = fs::read(sandbox.path().join(from))?;
	fs::remove_file(sandbox.path().join(from))?;

	let to = sandbox.path().join(to);
	if let Some(parent) = to.parent() {
		fs::create_dir_all(parent)?;
	}
	fs::write(to, content)?;
	Ok(())
}

/// commits of HEAD, newest first — the order a follower expects
fn commits(repo: &Repository) -> Result<Vec<Commit<'_>>> {
	let mut revwalk = repo.revwalk()?;
	revwalk.push_head()?;
	revwalk.map(|oid| Ok(repo.find_commit(oid?)?)).collect()
}

fn paths_of(diff: &gramaxgit::git2::Diff) -> Vec<String> {
	let mut paths: Vec<String> = diff
		.deltas()
		.filter_map(|delta| {
			let file = delta.new_file().path().or_else(|| delta.old_file().path())?;
			Some(file.to_str()?.to_string())
		})
		.collect();

	paths.sort();
	paths
}

/// alpha is written twice, an unrelated file is committed, then alpha is moved and edited again
fn moved_article(sandbox: &TempDir, repo: &Repo<TestCreds>) -> Result {
	write(sandbox, "alpha", "line1\nline2\nline3\nline4\nv1\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	write(sandbox, "alpha", "line1\nline2\nline3\nline4\nv2\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	write(sandbox, "beta", "unrelated\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	mv(sandbox, "alpha", "moved/alpha")?;
	repo.add_all()?;
	repo.commit_debug()?;

	write(sandbox, "moved/alpha", "line1\nline2\nline3\nline4\nv3\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	Ok(())
}

#[rstest]
fn follows_path_through_rename(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	moved_article(&sandbox, &repo)?;

	let git = repo.repo();
	let mut follower = PathFollower::new(vec!["moved/alpha".to_string()]);

	let touched = commits(git)?
		.iter()
		.map(|commit| Ok(follower.diff_commit(git, commit)?.is_some()))
		.collect::<Result<Vec<_>>>()?;

	// edit, move, unrelated commit, edit, creation, empty commit of the fixture
	assert_eq!(touched, vec![true, true, false, true, true, false]);
	assert_eq!(follower.paths(), ["alpha"], "path should be tracked under its pre-move name");

	Ok(())
}

#[rstest]
fn rewrites_path_only_on_the_move_commit(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	moved_article(&sandbox, &repo)?;

	let git = repo.repo();
	let commits = commits(git)?;
	let mut follower = PathFollower::new(vec!["moved/alpha".to_string()]);

	follower.diff_commit(git, &commits[0])?;
	assert_eq!(follower.paths(), ["moved/alpha"], "an edit should not touch the tracked path");

	follower.diff_commit(git, &commits[1])?;
	assert_eq!(follower.paths(), ["alpha"]);

	Ok(())
}

#[rstest]
fn move_diff_covers_both_names(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	moved_article(&sandbox, &repo)?;

	let git = repo.repo();
	let commits = commits(git)?;
	let mut follower = PathFollower::new(vec!["moved/alpha".to_string()]);

	follower.diff_commit(git, &commits[0])?;
	let diff = follower.diff_commit(git, &commits[1])?.expect("move commit touches the path");

	assert_eq!(paths_of(&diff), ["alpha", "moved/alpha"], "the move should be diffed under both names");

	Ok(())
}

#[rstest]
fn keeps_path_when_the_file_was_created(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	write(&sandbox, "alpha", "line1\nline2\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	let git = repo.repo();
	let commits = commits(git)?;
	let mut follower = PathFollower::new(vec!["alpha".to_string()]);

	assert!(follower.diff_commit(git, &commits[0])?.is_some(), "creation commit touches the path");
	assert_eq!(follower.paths(), ["alpha"], "an add without a rename source keeps the path");

	Ok(())
}

#[rstest]
fn ignores_renames_of_other_files(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	write(&sandbox, "alpha", "line1\nline2\nline3\nline4\nv1\n")?;
	write(&sandbox, "gamma", "other1\nother2\nother3\nother4\nv1\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	// alpha is only edited while gamma is moved away
	write(&sandbox, "alpha", "line1\nline2\nline3\nline4\nv2\n")?;
	mv(&sandbox, "gamma", "moved/gamma")?;
	repo.add_all()?;
	repo.commit_debug()?;

	let git = repo.repo();
	let commits = commits(git)?;
	let mut follower = PathFollower::new(vec!["alpha".to_string()]);

	let diff = follower.diff_commit(git, &commits[0])?.expect("alpha was edited");

	assert_eq!(paths_of(&diff), ["alpha"], "an unrelated rename should stay out of the diff");
	assert_eq!(follower.paths(), ["alpha"]);

	Ok(())
}

#[rstest]
fn follows_each_of_several_paths(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	write(&sandbox, "alpha", "line1\nline2\nline3\nline4\nv1\n")?;
	write(&sandbox, "beta", "other1\nother2\nother3\nother4\nv1\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	mv(&sandbox, "alpha", "moved/alpha")?;
	repo.add_all()?;
	repo.commit_debug()?;

	let git = repo.repo();
	let commits = commits(git)?;
	let mut follower = PathFollower::new(vec!["moved/alpha".to_string(), "beta".to_string()]);

	assert!(follower.diff_commit(git, &commits[0])?.is_some());
	assert_eq!(follower.paths(), ["alpha", "beta"], "only the moved path should be rewritten");

	assert!(
		follower.diff_commit(git, &commits[1])?.is_some(),
		"both files were created in the first commit"
	);

	Ok(())
}

/// commits `message` with the given parents and whatever is in the workdir
fn commit_with_parents(repo: &Repo<TestCreds>, message: &str, parents: &[Oid]) -> Result<Oid> {
	let git = repo.repo();
	let sig = Signature::now("test-user", "test@email.com")?;

	let mut index = git.index()?;
	index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)?;
	let tree = git.find_tree(index.write_tree()?)?;
	index.write()?;

	let parents = parents
		.iter()
		.map(|oid| git.find_commit(*oid))
		.collect::<std::result::Result<Vec<_>, _>>()?;
	let parents: Vec<_> = parents.iter().collect();

	Ok(git.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?)
}

#[rstest]
fn skips_merges_that_brought_the_paths_in_unchanged(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	write(&sandbox, "alpha", "line1\nline2\nv1\n")?;
	repo.add_all()?;
	let (base, _) = repo.commit_debug()?;

	// alpha is edited on a side branch
	repo.new_branch("feature")?;
	write(&sandbox, "alpha", "line1\nline2\nv2\n")?;
	repo.add_all()?;
	let (edit, _) = repo.commit_debug()?;

	// master only touches an unrelated file, then merges the branch in
	repo.checkout("master", true)?;
	write(&sandbox, "beta", "unrelated\n")?;
	repo.add_all()?;
	let (unrelated, _) = repo.commit_debug()?;

	write(&sandbox, "alpha", "line1\nline2\nv2\n")?;
	let merge = commit_with_parents(&repo, "merge feature", &[unrelated, edit])?;

	let git = repo.repo();
	let mut follower = PathFollower::new(vec!["alpha".to_string()]);

	assert!(
		follower.diff_commit(git, &git.find_commit(merge)?)?.is_none(),
		"the merge changed nothing itself"
	);
	assert!(follower.diff_commit(git, &git.find_commit(unrelated)?)?.is_none());
	assert!(
		follower.diff_commit(git, &git.find_commit(edit)?)?.is_some(),
		"the branch commit is the real edit"
	);
	assert!(follower.diff_commit(git, &git.find_commit(base)?)?.is_some());

	Ok(())
}

#[rstest]
fn keeps_merges_that_changed_the_paths(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	write(&sandbox, "alpha", "line1\nline2\nv1\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	repo.new_branch("feature")?;
	write(&sandbox, "alpha", "line1\nline2\nv2\n")?;
	repo.add_all()?;
	let (edit, _) = repo.commit_debug()?;

	repo.checkout("master", true)?;
	write(&sandbox, "alpha", "line1\nline2\nv3\n")?;
	repo.add_all()?;
	let (other_edit, _) = repo.commit_debug()?;

	// the merge resolves the two edits into a third state — that is an edit of its own
	write(&sandbox, "alpha", "line1\nline2\nresolved\n")?;
	let merge = commit_with_parents(&repo, "merge feature", &[other_edit, edit])?;

	let git = repo.repo();
	let mut follower = PathFollower::new(vec!["alpha".to_string()]);

	assert!(follower.diff_commit(git, &git.find_commit(merge)?)?.is_some());

	Ok(())
}

#[rstest]
fn returns_none_when_nothing_is_tracked(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	write(&sandbox, "alpha", "line1\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	let git = repo.repo();
	let commits = commits(git)?;
	let mut follower = PathFollower::new(vec!["never/committed".to_string()]);

	assert!(follower.diff_commit(git, &commits[0])?.is_none());

	Ok(())
}
