use std::collections::HashMap;
use std::collections::HashSet;
use std::ops::Deref;
use std::path::Path;
use std::path::PathBuf;

use git2::*;

use chrono::{DateTime, Utc};

use serde::Deserialize;
use serde::Serialize;

use crate::actions::diff::DiffFile;
use crate::creds::Creds;
use crate::error::OrUtf8Err;
use crate::prelude::Branch;
use crate::repo::Repo;
use crate::utils::md_frontmatter::MdFrontmatterParser;
use crate::OidInfo;
use crate::Result;
use crate::ShortInfo;
use crate::SignatureInfo;

const TAG: &str = "git:history";

#[derive(Serialize, Debug)]
#[serde(transparent)]
pub struct HistoryInfo(Vec<DiffFile>);

impl Deref for HistoryInfo {
	type Target = Vec<DiffFile>;

	fn deref(&self) -> &Self::Target {
		&self.0
	}
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommitPointInfo {
	pub date: i64,
	pub oid: OidInfo,
}

/// the two ends of a history: its oldest and its newest commit
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommitRangeInfo {
	pub start: CommitPointInfo,
	pub end: CommitPointInfo,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CommitAuthorInfo {
	#[serde(flatten)]
	pub author: SignatureInfo,
	pub count: usize,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BranchCommitsInfo {
	pub authors: Vec<CommitAuthorInfo>,
	pub commits: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CommitFilterOptions {
	pub authors: Option<Vec<String>>,
	pub before_date: Option<String>,
	pub after_date: Option<String>,
	/// exact paths, not globs: renames are followed by rewriting these strings, see `PathFollower`
	pub pathspecs: Option<Vec<String>>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfoOpts {
	pub depth: usize,
	#[serde(default)]
	pub simplify: bool,
	pub filters: Option<CommitFilterOptions>,
	pub include_changed_files: Option<bool>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFileInfo {
	pub path: String,
	pub title: Option<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StatInfo {
	pub added: usize,
	pub deleted: usize,
	pub changed_files: Option<Vec<ChangedFileInfo>>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
	pub author: SignatureInfo,
	pub timestamp: i64,
	pub oid: OidInfo,
	pub summary: String,
	pub parents: Vec<OidInfo>,
	pub stat: StatInfo,
}

pub trait History {
	fn history<P: AsRef<Path>>(&self, path: P, offset: usize, limit: usize) -> Result<HistoryInfo>;

	/// authors of the commits of the whole catalog — or, when `pathspecs` is given, only of the
	/// commits that edited these paths
	fn get_commit_authors(&self, pathspecs: Option<Vec<String>>) -> Result<Vec<CommitAuthorInfo>>;

	/// oldest and newest commit of the whole catalog — or, when `pathspecs` is given, of these paths;
	/// `None` when nothing in history matches
	fn get_commit_range(&self, pathspecs: Option<Vec<String>>) -> Result<Option<CommitRangeInfo>>;

	fn get_branch_commits<S: AsRef<str>>(&self, ours: S, theirs: S, max: Option<usize>) -> Result<BranchCommitsInfo>;

	fn get_commit_info(&self, oid: Oid, opts: CommitInfoOpts) -> Result<Vec<CommitInfo>>;
}

impl<C: Creds> Repo<'_, C> {
	/// calls `f` for every commit that edited `pathspecs` — or for every commit of the catalog when
	/// `pathspecs` is empty; renames are followed, so a path is seen under its older names too
	fn walk_matching<F>(&self, pathspecs: Option<Vec<String>>, mut f: F) -> Result<()>
	where
		F: FnMut(&Commit) -> Result<()>,
	{
		let mut follower = pathspecs.filter(|p| !p.is_empty()).map(PathFollower::new);

		// renames can only be followed along a single line of history, so the walk always starts at HEAD
		let mut revwalk = self.0.revwalk()?;
		revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
		revwalk.push_head()?;

		for oid in revwalk {
			let commit = self.0.find_commit(oid?)?;

			if let Some(follower) = follower.as_mut() {
				if follower.diff_commit(&self.0, &commit)?.is_none() {
					continue;
				}
			}

			f(&commit)?;
		}

		Ok(())
	}
}

impl<C: Creds> History for Repo<'_, C> {
	fn get_commit_info(&self, oid: Oid, opts: CommitInfoOpts) -> Result<Vec<CommitInfo>> {
		let mut res = Vec::with_capacity(opts.depth);

		let filter_authors: Option<HashSet<&str>> = opts
			.filters
			.as_ref()
			.and_then(|f| f.authors.as_deref())
			.filter(|v| !v.is_empty())
			.map(|v| v.iter().map(|s| s.as_str()).collect());

		let filter_before = opts
			.filters
			.as_ref()
			.and_then(|f| f.before_date.as_deref())
			.and_then(|s| DateTime::parse_from_rfc3339(s).ok())
			.map(|dt| dt.with_timezone(&Utc).timestamp());

		let filter_after = opts
			.filters
			.as_ref()
			.and_then(|f| f.after_date.as_deref())
			.and_then(|s| DateTime::parse_from_rfc3339(s).ok())
			.map(|dt| dt.with_timezone(&Utc).timestamp());

		let include_changed_files = opts.include_changed_files.unwrap_or(false);

		let mut follower = opts
			.filters
			.as_ref()
			.and_then(|f| f.pathspecs.clone())
			.filter(|p| !p.is_empty())
			.map(PathFollower::new);

		let mut revwalk = self.0.revwalk()?;
		revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
		revwalk.push(oid)?;

		// a first parent walk hides everything that came in through a merge, so paths — which have to
		// find the commit that actually edited them — are followed over the whole graph instead
		if opts.simplify && follower.is_none() {
			revwalk.simplify_first_parent()?;
		}

		for oid in revwalk {
			if res.len() >= opts.depth {
				break;
			}

			let oid = oid?;
			let commit = self.0.find_commit(oid)?;
			let author = commit.author();
			let commit_time = commit.time().seconds();

			if let Some(after) = filter_after {
				if commit_time <= after {
					break;
				}
			}

			// pathspecs are followed before the other filters: a rename made by a filtered out commit still moves the trail
			let path_diff = match follower.as_mut() {
				Some(follower) => match follower.diff_commit(&self.0, &commit)? {
					Some(diff) => Some(diff),
					None => continue,
				},
				None => None,
			};

			if let Some(before) = filter_before {
				if commit_time >= before {
					continue;
				}
			}

			if let Some(filter) = &filter_authors {
				if !filter.contains(author.email().unwrap_or("")) {
					continue;
				}
			}

			let commit_tree = commit.tree()?;
			let parent_tree = commit.parents().next().and_then(|p| p.tree().ok());

			let diff = match path_diff {
				Some(diff) => diff,
				None => self.0.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)?,
			};

			let diff_stats = diff.stats()?;

			let mut changed_files: Option<Vec<ChangedFileInfo>> = None;
			if include_changed_files {
				let file_changes = std::cell::RefCell::new(Vec::<(String, u32, bool)>::new());

				diff.foreach(
					&mut |delta, _| {
						let deleted = delta.status() == Delta::Deleted;
						let path = delta
							.new_file()
							.path()
							.or_else(|| delta.old_file().path())
							.and_then(|p| p.to_str())
							.unwrap_or("")
							.to_string();
						file_changes.borrow_mut().push((path, 0, deleted));
						true
					},
					None,
					Some(&mut |_c_delta, hunk| {
						if let Some(last) = file_changes.borrow_mut().last_mut() {
							last.1 += hunk.old_lines() + hunk.new_lines();
						}
						true
					}),
					None,
				)?;

				let mut file_changes = file_changes.into_inner();

				file_changes.sort_by(|a, b| b.1.cmp(&a.1));
				changed_files = Some(
					file_changes
						.into_iter()
						.map(|(path, _, deleted)| {
							let title = if path.ends_with(".md") {
								let tree = if deleted { parent_tree.as_ref() } else { Some(&commit_tree) };

								tree
									.and_then(|t| t.get_path(std::path::Path::new(&path)).ok())
									.and_then(|entry| entry.to_object(&self.0).ok())
									.and_then(|obj| obj.into_blob().ok())
									.and_then(|blob| {
										let content = std::str::from_utf8(blob.content()).ok()?;
										MdFrontmatterParser.parse_frontmatter(content).ok()?.title
									})
							} else {
								None
							};
							ChangedFileInfo { path, title }
						})
						.collect(),
				);
			}

			let stat = StatInfo {
				added: diff_stats.insertions(),
				deleted: diff_stats.deletions(),
				changed_files,
			};

			let timestamp = commit_time * 1000;
			let summary = commit.summary().or_utf8_err()?.to_string();
			let parents = commit.parents().filter_map(|p| p.id().short_info().ok()).collect();

			res.push(CommitInfo {
				author: author.short_info()?,
				timestamp,
				oid: oid.short_info()?,
				summary,
				parents,
				stat,
			});
		}

		Ok(res)
	}

	fn get_commit_authors(&self, pathspecs: Option<Vec<String>>) -> Result<Vec<CommitAuthorInfo>> {
		let mut authors = HashMap::new();

		self.walk_matching(pathspecs, |commit| {
			let author = commit.author();
			let author_email = author.email().unwrap_or("<invalid-utf8>");

			match authors.get_mut(author_email) {
				Some(count) => *count += 1,
				None => {
					authors.insert(author.short_info()?, 1);
				}
			}

			Ok(())
		})?;

		Ok(authors.into_iter().map(|(author, count)| CommitAuthorInfo { author, count }).collect())
	}

	fn get_commit_range(&self, pathspecs: Option<Vec<String>>) -> Result<Option<CommitRangeInfo>> {
		let mut range: Option<CommitRangeInfo> = None;

		self.walk_matching(pathspecs, |commit| {
			let point = CommitPointInfo { date: commit.time().seconds() * 1000, oid: commit.id().short_info()? };

			// the ends are the oldest and the newest commit by date, not by walk order: after a rebase
			// or an import these are not the same commits
			range = Some(match range.take() {
				Some(range) => CommitRangeInfo {
					start: if point.date < range.start.date { point.clone() } else { range.start },
					end: if point.date > range.end.date { point } else { range.end },
				},
				None => CommitRangeInfo { start: point.clone(), end: point },
			});

			Ok(())
		})?;

		Ok(range)
	}

	fn get_branch_commits<S: AsRef<str>>(&self, ours: S, theirs: S, limit: Option<usize>) -> Result<BranchCommitsInfo> {
		let mut authors = HashMap::new();
		let mut commits = vec![];

		let theirs = self.branch_by_name(theirs.as_ref(), None)?;

		let ours = self.branch_by_name(ours.as_ref(), None)?;

		let mut revwalk = self.0.revwalk()?;
		revwalk.push_range(&format!("{}..{}", ours.last_commit.id(), theirs.last_commit.id()))?;

		for oid in revwalk.take(limit.unwrap_or(usize::MAX)) {
			let commit = self.0.find_commit(oid?)?;
			let author = commit.author().short_info()?;

			match commit.summary() {
				Some(summary) => commits.push(summary.to_string()),
				None => commits.push(format!("{} <invalid summary utf-8>", commit.id())),
			}

			match authors.get_mut(&author) {
				Some(count) => *count += 1,
				None => {
					authors.insert(author, 1);
				}
			}
		}

		let authors = authors.into_iter().map(|(author, count)| CommitAuthorInfo { author, count }).collect();

		Ok(BranchCommitsInfo { authors, commits })
	}

	fn history<P: AsRef<Path>>(&self, path: P, offset: usize, limit: usize) -> Result<HistoryInfo> {
		let path = path.as_ref().to_str().or_utf8_err()?.to_string();
		let mut follower = PathFollower::new(vec![path.clone()]);

		let mut revwalk = self.0.revwalk()?;
		revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;
		revwalk.push_head()?;

		let mut history = vec![];
		let mut found = 0;
		let mut inspected = 0;
		let mut current_path = path;
		let total_needed = offset + limit;

		for oid in revwalk {
			if found >= total_needed {
				break;
			}

			inspected += 1;
			let commit = self.0.find_commit(oid?)?;

			let Some(diff) = follower.diff_commit(&self.0, &commit)? else {
				continue;
			};

			// the name the file has in this commit; the follower has already rewritten it to the older
			// one, so it is the older name that goes to `parent_path`
			let name = std::mem::replace(&mut current_path, follower.paths().first().cloned().unwrap_or_default());

			let Some(delta) = diff.deltas().find(|delta| delta.new_file().path().and_then(Path::to_str) == Some(&name))
			else {
				continue;
			};

			found += 1;
			if found <= offset {
				continue;
			}

			let file = DiffFile::from_diff_delta(&commit, &delta)?;
			let file = match current_path == name {
				true => file,
				false => file.with_parent_path(PathBuf::from(&current_path)),
			};

			history.push(file);
		}

		info!(
			target: TAG,
			"looked up for history of file {}; inspected {} commits & collected {}/{} history entries (offset: {})",
			current_path,
			inspected,
			history.len(),
			limit,
			offset
		);

		Ok(HistoryInfo(history))
	}
}

/// Walks a set of paths back through history, rewriting them to their older names on every rename.
///
/// Commits must be fed in reverse chronological order (as a revwalk yields them) and the walk must
/// cover every parent — a rename is only picked up if the commit that made it is seen, and merges
/// are reported as no-ops on the assumption that the commit behind them is seen too.
pub struct PathFollower {
	paths: Vec<String>,
}

impl PathFollower {
	pub fn new(paths: Vec<String>) -> Self {
		Self { paths }
	}

	/// paths as they are named at the currently reached point in history
	pub fn paths(&self) -> &[String] {
		&self.paths
	}

	/// diff of the commit limited to the tracked paths; `None` when the commit doesn't change them
	pub fn diff_commit<'r>(&mut self, repo: &'r Repository, commit: &Commit) -> Result<Option<Diff<'r>>> {
		let commit_tree = commit.tree()?;
		let mut parents = commit.parents();

		let Some(first_parent) = parents.next() else {
			return self.diff(repo, None, &commit_tree);
		};

		// a merge that brought the paths in unchanged from one side made no edit of its own — the
		// commit that did is on that side and gets reported there
		for parent in parents {
			if !self.touches(repo, Some(&parent.tree()?), &commit_tree)? {
				return Ok(None);
			}
		}

		self.diff(repo, Some(&first_parent.tree()?), &commit_tree)
	}

	fn touches(&self, repo: &Repository, parent_tree: Option<&Tree>, commit_tree: &Tree) -> Result<bool> {
		let mut diff_opts = path_diff_opts(&self.paths);
		let diff = repo.diff_tree_to_tree(parent_tree, Some(commit_tree), Some(&mut diff_opts))?;

		Ok(diff.deltas().next().is_some())
	}

	fn diff<'r>(&mut self, repo: &'r Repository, parent_tree: Option<&Tree>, commit_tree: &Tree) -> Result<Option<Diff<'r>>> {
		let mut diff_opts = path_diff_opts(&self.paths);
		let diff = repo.diff_tree_to_tree(parent_tree, Some(commit_tree), Some(&mut diff_opts))?;

		if diff.deltas().next().is_none() {
			return Ok(None);
		}

		// a tracked path added in this commit may be a rename — keep following it under its older name
		let added: HashSet<String> = diff
			.deltas()
			.filter(|delta| delta.status() == Delta::Added)
			.filter_map(|delta| delta.new_file().path()?.to_str().map(str::to_string))
			.filter(|path| self.paths.contains(path))
			.collect();

		if added.is_empty() {
			return Ok(Some(diff));
		}

		let renames = find_rename_sources(repo, parent_tree, commit_tree, &added)?;

		if renames.is_empty() {
			return Ok(Some(diff));
		}

		// diff again over both names so the commit's stat & changed files cover the whole move
		let mut pathspec = self.paths.clone();
		pathspec.extend(renames.values().cloned());

		for (new_path, old_path) in &renames {
			for path in self.paths.iter_mut().filter(|path| *path == new_path) {
				*path = old_path.clone();
			}
		}

		self.paths.sort();
		self.paths.dedup();

		let mut diff_opts = path_diff_opts(&pathspec);
		Ok(Some(repo.diff_tree_to_tree(parent_tree, Some(commit_tree), Some(&mut diff_opts))?))
	}
}

fn path_diff_opts(paths: &[String]) -> DiffOptions {
	let mut opts = DiffOptions::new();
	for path in paths {
		opts.pathspec(path);
	}
	opts.skip_binary_check(true);
	opts.include_typechange(false);
	opts.ignore_blank_lines(true);
	opts.patience(false);
	opts
}

/// maps `added` paths that came from a rename to the path they were renamed from
fn find_rename_sources(
	repo: &Repository,
	parent_tree: Option<&Tree>,
	commit_tree: &Tree,
	added: &HashSet<String>,
) -> Result<HashMap<String, String>> {
	let mut diff = repo.diff_tree_to_tree(parent_tree, Some(commit_tree), None)?;
	let mut find_opts = DiffFindOptions::new();
	find_opts.renames(true);
	diff.find_similar(Some(&mut find_opts))?;

	let mut sources = HashMap::new();

	for delta in diff.deltas() {
		if !matches!(delta.status(), Delta::Renamed | Delta::Copied) {
			continue;
		}

		let (Some(new_path), Some(old_path)) = (delta.new_file().path(), delta.old_file().path()) else {
			continue;
		};

		let (Some(new_path), Some(old_path)) = (new_path.to_str(), old_path.to_str()) else {
			continue;
		};

		if !added.contains(new_path) {
			continue;
		}

		sources.insert(new_path.to_string(), old_path.to_string());
	}

	Ok(sources)
}
