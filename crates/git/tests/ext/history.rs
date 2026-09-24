use gramaxgit::ext::history::CommitFilterOptions;
use gramaxgit::prelude::*;

use std::fs;

use test_utils::git::*;
use test_utils::*;

fn commit_all_at(repo: &Repo<TestCreds>, message: &str, timestamp: i64) -> Result<Oid> {
	let sig = Signature::new("test-user", "test@email.com", &git2::Time::new(timestamp, 0))?;
	let mut index = repo.repo().index()?;
	index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)?;
	let tree_oid = index.write_tree()?;
	index.write()?;
	let tree = repo.repo().find_tree(tree_oid)?;

	let head = repo.repo().head().ok().and_then(|h| h.peel_to_commit().ok());
	let parents: Vec<_> = head.iter().collect();

	let oid = repo.repo().commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;
	Ok(oid)
}

fn commit_at(repo: &Repo<TestCreds>, sandbox: &TempDir, content: &str, timestamp: i64) -> Result<Oid> {
	let filename = format!("file_{}", content.replace(' ', "_"));
	fs::write(sandbox.path().join(&filename), content)?;
	repo.add(&filename)?;

	commit_all_at(repo, content, timestamp)
}

fn commit_by(repo: &Repo<TestCreds>, name: &str, email: &str, message: &str) -> Result<Oid> {
	let sig = Signature::now(name, email)?;

	let mut index = repo.repo().index()?;
	index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)?;
	let tree_oid = index.write_tree()?;
	index.write()?;
	let tree = repo.repo().find_tree(tree_oid)?;

	let head = repo.repo().head().ok().and_then(|h| h.peel_to_commit().ok());
	let parents: Vec<_> = head.iter().collect();

	Ok(repo.repo().commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?)
}

#[rstest]
fn file_history(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("file"), "init")?;
	repo.add("file")?;
	repo.commit_debug()?;
	fs::write(sandbox.path().join("file"), "222")?;
	repo.commit_debug()?;
	repo.add("file")?;
	fs::write(sandbox.path().join("file_2"), "init")?;
	repo.add("file_2")?;
	repo.commit_debug()?;

	let diff = repo.history("file", 0, 10)?;

	assert_eq!(diff.len(), 2);
	Ok(())
}

#[rstest]
fn file_history_with_rename(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("file"), "init\ninit\ninit\ninit\ninit")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("file"), "init\ninit\ninit\ninit\n123")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("file"), "init\ninit\ninit\ninit\n222")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("file"), "init\ninit\ninit\ninit\n333")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("file_2"), "init\ninit\ninit\ninit\n555")?;
	fs::remove_file(sandbox.path().join("file"))?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("file_2"), "init\ninit\ninit\ninit\n666")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("file_3"), "init\ninit\ninit\ninit\n666")?;
	fs::remove_file(sandbox.path().join("file_2"))?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("file_4"), "init\ninit\ninit\ninit\n777")?;
	fs::remove_file(sandbox.path().join("file_3"))?;
	repo.add_all()?;
	repo.commit_debug()?;

	let diff = repo.history("file_4", 0, 10)?;

	assert_eq!(diff.len(), 8);

	Ok(())
}

#[rstest]
fn get_all_branch_commiters_with_limit(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("file"), "init")?;
	repo.add("file")?;
	repo.commit_debug()?;

	repo.new_branch("feature")?;

	for i in 1..=5 {
		fs::write(sandbox.path().join("file"), format!("feature{i}"))?;
		repo.add("file")?;
		repo.commit_debug()?;
	}

	let commiters = repo.get_branch_commits("master", "feature", Some(3))?;

	assert_eq!(commiters.authors.len(), 1, "should have 1 author");
	assert_eq!(commiters.authors[0].count, 3, "should have 3 commits");
	assert_eq!(commiters.commits.len(), 3, "should have 3 commits");

	Ok(())
}

#[rstest]
fn get_all_branch_commiters_with_target_branch(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	// create a new branch and make commits on it
	repo.new_branch("feature")?;

	// make 3 commits on feature branch
	for i in 1..=3 {
		fs::write(sandbox.path().join("file"), format!("feature{i}"))?;
		repo.add("file")?;
		repo.commit_debug()?;
	}

	repo.checkout("master", true)?;

	std::fs::write(sandbox.path().join("file"), "master commit")?;
	repo.add("file")?;
	repo.commit(CommitOptions {
		message: "master commit".to_string(),
		parent_refs: None,
		files: None,
	})?;

	repo.checkout("feature", true)?;
	repo.merge(MergeOptions::theirs("master"))?;

	let commiters = repo.get_branch_commits("master", "feature", None)?;

	assert!(!commiters.commits.iter().any(|c| c == "master commit"));

	assert_eq!(commiters.authors.len(), 1, "should have 1 author");
	assert_eq!(commiters.authors[0].count, 3, "should have 3 commits (commits on feature)");
	assert_eq!(commiters.commits.len(), 3, "should have 3 commits (commits on feature)");

	Ok(())
}

#[rstest]
fn get_commit_info(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("file"), "init")?;
	repo.add("file")?;
	repo.commit_debug()?;

	let mut oids = Vec::new();

	// prepare
	for i in 1..=10 {
		fs::write(sandbox.path().join("file"), format!("init{i}"))?;
		repo.add("file")?;
		let info = repo.commit_debug()?;
		oids.push(info);
	}
	oids.reverse();

	// get commit info
	let head = repo.repo().head()?.peel_to_commit()?;
	let commit_info_only_head = repo.get_commit_info(head.id(), CommitInfoOpts { depth: 1, simplify: true, filters: None, include_changed_files: None })?;

	assert_eq!(commit_info_only_head.len(), 1);
	assert_eq!(commit_info_only_head.first().unwrap().oid, oids.first().unwrap().0.short_info()?);
	assert_eq!(commit_info_only_head.first().unwrap().summary, oids.first().unwrap().1);

	// get commit info with depth 10
	let commit_info_10 = repo.get_commit_info(head.id(), CommitInfoOpts { depth: 10, simplify: true, filters: None, include_changed_files: None })?;

	commit_info_10.iter().zip(&oids).for_each(|(info, oid)| {
		assert_eq!(
			info.oid,
			oid.0.short_info().unwrap(),
			"get commit info with depth 10: {} != {}",
			*info.oid,
			oid.0
		)
	});

	// get commit info depth 2 since specific commit
	let index = oids.len() / 2;
	let depth = 2;
	let oid = oids.get(index).unwrap().0;

	let commit_info_2 = repo.get_commit_info(oid, CommitInfoOpts { depth, simplify: true, filters: None, include_changed_files: None })?;

	commit_info_2.iter().zip(oids.iter().take(depth).skip(index)).for_each(|(info, oid)| {
		assert_eq!(
			info.oid,
			oid.0.short_info().unwrap(),
			"get commit info with depth 2 and index {}: {} != {}",
			index,
			*info.oid,
			oid.0
		)
	});

	Ok(())
}

#[rstest]
fn get_commit_info_stat(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("file"), "line1\nline2\nline3\n")?;
	repo.add("file")?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("file"), "line1\nline2\nchanged\n")?;
	repo.add("file")?;
	repo.commit_debug()?;

	let head = repo.repo().head()?.peel_to_commit()?;
	let commit_info = repo.get_commit_info(head.id(), CommitInfoOpts { depth: 3, simplify: true, filters: None, include_changed_files: None })?;

	assert_eq!(commit_info.len(), 3);

	let second_commit = &commit_info[0];
	assert_eq!(second_commit.stat.added, 1, "second commit should have 1 added line");
	assert_eq!(second_commit.stat.deleted, 1, "second commit should have 1 deleted line");

	let first_commit = &commit_info[1];
	assert_eq!(first_commit.stat.added, 3, "initial commit should have 3 added lines");
	assert_eq!(first_commit.stat.deleted, 0, "initial commit should have 0 deleted lines");

	Ok(())
}

const JAN_1: i64 = 1704067200;
const FEB_1: i64 = 1706745600;
const MAR_1: i64 = 1709251200;

#[rstest]
fn get_commit_info_filter_by_date(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	commit_at(&repo, &sandbox, "jan commit", JAN_1)?;
	commit_at(&repo, &sandbox, "feb commit", FEB_1)?;
	commit_at(&repo, &sandbox, "mar commit", MAR_1)?;

	let head = repo.repo().head()?.peel_to_commit()?;

	let result = repo.get_commit_info(
		head.id(),
		CommitInfoOpts {
			depth: 10,
			simplify: false,
			filters: Some(CommitFilterOptions {
				authors: None,
				after_date: Some("2024-01-01T00:00:00Z".to_string()),
				before_date: Some("2024-03-01T00:00:00Z".to_string()),
				pathspecs: None,
			}),
			include_changed_files: None,
		},
	)?;

	assert_eq!(result.len(), 1, "should return only the february commit");
	assert_eq!(result[0].summary, "feb commit");

	Ok(())
}

#[rstest]
fn get_commit_info_filter_by_author(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	commit_at(&repo, &sandbox, "jan commit", JAN_1)?;
	commit_at(&repo, &sandbox, "feb commit", FEB_1)?;

	{
		let other_sig = Signature::new("other-user", "other@email.com", &git2::Time::new(MAR_1, 0))?;
		fs::write(sandbox.path().join("other_file"), "other")?;
		let mut index = repo.repo().index()?;
		index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)?;
		let tree_oid = index.write_tree()?;
		index.write()?;
		let tree = repo.repo().find_tree(tree_oid)?;
		let parent = repo.repo().head()?.peel_to_commit()?;
		repo.repo().commit(Some("HEAD"), &other_sig, &other_sig, "other commit", &tree, &[&parent])?;
	}

	let head = repo.repo().head()?.peel_to_commit()?;

	let result = repo.get_commit_info(
		head.id(),
		CommitInfoOpts {
			depth: 10,
			simplify: false,
			filters: Some(CommitFilterOptions {
				authors: Some(vec!["test@email.com".to_string()]),
				after_date: None,
				before_date: None,
				pathspecs: None,
			}),
			include_changed_files: None,
		},
	)?;

	assert!(result.iter().all(|c| c.author.email == "test@email.com"), "should return only commits by test-user");
	assert!(!result.iter().any(|c| c.author.email == "other@email.com"), "should not return other-user commits");

	Ok(())
}

#[rstest]
fn get_commit_info_filter_after_date_stops_early(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	commit_at(&repo, &sandbox, "jan commit", JAN_1)?;
	commit_at(&repo, &sandbox, "feb commit", FEB_1)?;
	commit_at(&repo, &sandbox, "mar commit", MAR_1)?;

	let head = repo.repo().head()?.peel_to_commit()?;

	let result = repo.get_commit_info(
		head.id(),
		CommitInfoOpts {
			depth: 10,
			simplify: false,
			filters: Some(CommitFilterOptions {
				authors: None,
				after_date: Some("2024-02-01T00:00:00Z".to_string()),
				before_date: None,
				pathspecs: None,
			}),
			include_changed_files: None,
		},
	)?;

	assert!(result.iter().any(|c| c.summary == "mar commit"), "should include mar commit");
	assert!(!result.iter().any(|c| c.summary == "feb commit"), "should not include feb commit");
	assert!(!result.iter().any(|c| c.summary == "jan commit"), "should not include jan commit");

	Ok(())
}

#[rstest]
fn get_commit_info_filter_by_pathspecs(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	// commit touching "alpha"
	fs::write(sandbox.path().join("alpha"), "v1")?;
	repo.add_all()?;
	repo.commit_debug()?;

	// commit touching only "beta"
	fs::write(sandbox.path().join("beta"), "v1")?;
	repo.add_all()?;
	repo.commit_debug()?;

	// commit touching "alpha" again
	fs::write(sandbox.path().join("alpha"), "v2")?;
	repo.add_all()?;
	repo.commit_debug()?;

	let head = repo.repo().head()?.peel_to_commit()?;

	let result = repo.get_commit_info(
		head.id(),
		CommitInfoOpts {
			depth: 10,
			simplify: false,
			filters: Some(CommitFilterOptions {
				authors: None,
				after_date: None,
				before_date: None,
				pathspecs: Some(vec!["alpha".to_string()]),
			}),
			include_changed_files: None,
		},
	)?;

	assert_eq!(result.len(), 2, "should return only commits that touched alpha");
	assert!(result.iter().all(|c| c.summary != "beta"), "beta-only commit should be excluded");

	Ok(())
}

#[rstest]
fn get_commit_info_filter_by_pathspecs_multiple(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("alpha"), "v1")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("beta"), "v1")?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("gamma"), "v1")?;
	repo.add_all()?;
	repo.commit_debug()?;

	let head = repo.repo().head()?.peel_to_commit()?;

	let result = repo.get_commit_info(
		head.id(),
		CommitInfoOpts {
			depth: 10,
			simplify: false,
			filters: Some(CommitFilterOptions {
				authors: None,
				after_date: None,
				before_date: None,
				pathspecs: Some(vec!["alpha".to_string(), "beta".to_string()]),
			}),
			include_changed_files: None,
		},
	)?;

	assert_eq!(result.len(), 2, "should return commits touching alpha or beta");

	Ok(())
}

#[rstest]
fn get_commit_info_filter_by_pathspecs_looks_past_merges(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("alpha"), "line1\nline2\nv1\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	// alpha is edited on a side branch, master only touches an unrelated file
	repo.new_branch("feature")?;
	fs::write(sandbox.path().join("alpha"), "line1\nline2\nv2\n")?;
	repo.add_all()?;
	let (edit, edit_summary) = repo.commit_debug()?;

	repo.checkout("master", true)?;
	fs::write(sandbox.path().join("beta"), "unrelated\n")?;
	repo.add_all()?;
	let (unrelated, _) = repo.commit_debug()?;

	fs::write(sandbox.path().join("alpha"), "line1\nline2\nv2\n")?;
	let sig = Signature::now("test-user", "test@email.com")?;
	let mut index = repo.repo().index()?;
	index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)?;
	let tree = repo.repo().find_tree(index.write_tree()?)?;
	index.write()?;
	let parents = [repo.repo().find_commit(unrelated)?, repo.repo().find_commit(edit)?];
	let merge =
		repo.repo().commit(Some("HEAD"), &sig, &sig, "merge feature", &tree, &[&parents[0], &parents[1]])?;

	let result = repo.get_commit_info(
		merge,
		CommitInfoOpts {
			depth: 10,
			simplify: true,
			filters: Some(CommitFilterOptions {
				authors: None,
				after_date: None,
				before_date: None,
				pathspecs: Some(vec!["alpha".to_string()]),
			}),
			include_changed_files: None,
		},
	)?;

	let summaries: Vec<_> = result.iter().map(|c| c.summary.as_str()).collect();

	assert!(summaries.contains(&edit_summary.as_str()), "the commit merged in is the one that edited alpha");
	assert!(!summaries.contains(&"merge feature"), "the merge itself changed nothing");

	Ok(())
}

#[rstest]
fn get_commit_authors_of_the_whole_catalog(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("alpha"), "v1")?;
	commit_by(&repo, "alpha-author", "alpha@email.com", "alpha")?;

	fs::write(sandbox.path().join("beta"), "v1")?;
	commit_by(&repo, "beta-author", "beta@email.com", "beta")?;

	let authors = repo.get_commit_authors(None)?;
	let emails: Vec<_> = authors.iter().map(|a| a.author.email.as_str()).collect();

	assert!(emails.contains(&"alpha@email.com"));
	assert!(emails.contains(&"beta@email.com"));

	Ok(())
}

#[rstest]
fn get_commit_authors_of_pathspecs_follows_renames(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("alpha"), "line1\nline2\nline3\nline4\nv1\n")?;
	commit_by(&repo, "alpha-author", "alpha@email.com", "alpha")?;

	fs::write(sandbox.path().join("beta"), "v1")?;
	commit_by(&repo, "beta-author", "beta@email.com", "beta")?;

	fs::create_dir_all(sandbox.path().join("moved"))?;
	fs::write(sandbox.path().join("moved/alpha"), "line1\nline2\nline3\nline4\nv1\n")?;
	fs::remove_file(sandbox.path().join("alpha"))?;
	commit_by(&repo, "mover", "mover@email.com", "move alpha")?;

	let authors = repo.get_commit_authors(Some(vec!["moved/alpha".to_string()]))?;
	let emails: Vec<_> = authors.iter().map(|a| a.author.email.as_str()).collect();

	assert!(emails.contains(&"alpha@email.com"), "author from before the move should be kept");
	assert!(emails.contains(&"mover@email.com"), "author of the move itself should be kept");
	assert!(!emails.contains(&"beta@email.com"), "author of an unrelated file should be dropped");

	Ok(())
}

#[rstest]
fn get_commit_range_of_the_whole_catalog(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	// the commit the fixture starts the repo with is dated now, so it stays the newest one
	let init = repo.repo().head()?.peel_to_commit()?.id();

	let jan = commit_at(&repo, &sandbox, "jan commit", JAN_1)?;
	commit_at(&repo, &sandbox, "feb commit", FEB_1)?;
	commit_at(&repo, &sandbox, "mar commit", MAR_1)?;

	let range = repo.get_commit_range(None)?.expect("the catalog has commits");

	assert_eq!(range.start.date, JAN_1 * 1000, "the range starts at the oldest commit");
	assert_eq!(range.start.oid, jan.short_info()?);
	assert_eq!(range.end.oid, init.short_info()?, "the ends are picked by date, not by walk order");

	Ok(())
}

#[rstest]
fn get_commit_range_of_pathspecs_follows_renames(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("alpha"), "line1\nline2\nline3\nline4\nv1\n")?;
	let created = commit_all_at(&repo, "create alpha", JAN_1)?;

	fs::write(sandbox.path().join("beta"), "v1")?;
	commit_all_at(&repo, "unrelated file", MAR_1)?;

	fs::create_dir_all(sandbox.path().join("moved"))?;
	fs::write(sandbox.path().join("moved/alpha"), "line1\nline2\nline3\nline4\nv1\n")?;
	fs::remove_file(sandbox.path().join("alpha"))?;
	let moved = commit_all_at(&repo, "move alpha", FEB_1)?;

	let range = repo.get_commit_range(Some(vec!["moved/alpha".to_string()]))?.expect("the path has commits");

	assert_eq!(range.start.oid, created.short_info()?, "the range starts before the move");
	assert_eq!(range.end.oid, moved.short_info()?, "the commit of an unrelated file stays out of the range");

	Ok(())
}

#[rstest]
fn get_commit_range_is_none_for_an_unknown_path(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	fs::write(sandbox.path().join("alpha"), "v1")?;
	repo.add_all()?;
	repo.commit_debug()?;

	assert!(repo.get_commit_range(Some(vec!["never/committed".to_string()]))?.is_none());

	Ok(())
}

#[rstest]
fn file_history_resolves_a_merge_into_the_commit_behind_it(
	sandbox: TempDir,
	#[with(&sandbox)] repo: Repo<TestCreds>,
) -> Result {
	fs::write(sandbox.path().join("alpha"), "line1\nline2\nv1\n")?;
	repo.add_all()?;
	repo.commit_debug()?;

	// alpha is edited on a side branch, master only touches an unrelated file
	repo.new_branch("feature")?;
	fs::write(sandbox.path().join("alpha"), "line1\nline2\nv2\n")?;
	repo.add_all()?;
	let (edit, _) = repo.commit_debug()?;

	repo.checkout("master", true)?;
	fs::write(sandbox.path().join("beta"), "unrelated\n")?;
	repo.add_all()?;
	let (unrelated, _) = repo.commit_debug()?;

	fs::write(sandbox.path().join("alpha"), "line1\nline2\nv2\n")?;
	let sig = Signature::now("test-user", "test@email.com")?;
	let mut index = repo.repo().index()?;
	index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)?;
	let tree = repo.repo().find_tree(index.write_tree()?)?;
	index.write()?;
	let parents = [repo.repo().find_commit(unrelated)?, repo.repo().find_commit(edit)?];
	repo.repo().commit(Some("HEAD"), &sig, &sig, "merge feature", &tree, &[&parents[0], &parents[1]])?;

	let history = repo.history("alpha", 0, 10)?;
	let commits: Vec<_> = history.iter().map(|d| d.commit_oid()).collect();

	assert!(commits.contains(&edit.to_string().as_str()), "the commit merged in is the one that edited alpha");
	assert_eq!(history.len(), 2, "the merge itself changed nothing, so only the edit and the creation are left");

	Ok(())
}

#[rstest]
fn get_commit_info_filter_by_pathspecs_follows_renames(sandbox: TempDir, #[with(&sandbox)] repo: Repo<TestCreds>) -> Result {
	let content = |last: &str| format!("line1\nline2\nline3\nline4\n{last}\n");

	fs::write(sandbox.path().join("alpha"), content("v1"))?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("alpha"), content("v2"))?;
	repo.add_all()?;
	repo.commit_debug()?;

	// commit touching an unrelated file
	fs::write(sandbox.path().join("beta"), "beta")?;
	repo.add_all()?;
	repo.commit_debug()?;

	// move alpha -> moved/alpha
	fs::create_dir_all(sandbox.path().join("moved"))?;
	fs::write(sandbox.path().join("moved/alpha"), content("v2"))?;
	fs::remove_file(sandbox.path().join("alpha"))?;
	repo.add_all()?;
	repo.commit_debug()?;

	fs::write(sandbox.path().join("moved/alpha"), content("v3"))?;
	repo.add_all()?;
	repo.commit_debug()?;

	let head = repo.repo().head()?.peel_to_commit()?;

	let result = repo.get_commit_info(
		head.id(),
		CommitInfoOpts {
			depth: 10,
			simplify: false,
			filters: Some(CommitFilterOptions {
				authors: None,
				after_date: None,
				before_date: None,
				pathspecs: Some(vec!["moved/alpha".to_string()]),
			}),
			include_changed_files: Some(true),
		},
	)?;

	assert_eq!(result.len(), 4, "should return commits from before and after the move");

	let move_commit = &result[1];
	let changed: Vec<_> = move_commit.stat.changed_files.as_ref().unwrap().iter().map(|f| f.path.as_str()).collect();
	assert!(changed.contains(&"moved/alpha"), "move commit should list the new path");
	assert!(changed.contains(&"alpha"), "move commit should list the old path");

	Ok(())
}

#[rstest]
fn get_commit_info_filter_by_pathspecs_empty_returns_all(
	sandbox: TempDir,
	#[with(&sandbox)] repo: Repo<TestCreds>,
) -> Result {
	for i in 1..=3 {
		fs::write(sandbox.path().join(format!("file{i}")), "content")?;
		repo.add_all()?;
		repo.commit_debug()?;
	}

	let head = repo.repo().head()?.peel_to_commit()?;

	let result = repo.get_commit_info(
		head.id(),
		CommitInfoOpts {
			depth: 10,
			simplify: false,
			filters: Some(CommitFilterOptions {
				authors: None,
				after_date: None,
				before_date: None,
				pathspecs: Some(vec![]),
			}),
			include_changed_files: None,
		},
	)?;

	assert!(result.len() >= 3, "empty pathspecs filter should not exclude any commits");

	Ok(())
}
