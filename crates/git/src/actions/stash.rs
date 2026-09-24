use std::collections::HashSet;
use std::path::PathBuf;

use crate::creds::Creds;
use crate::error::Result;
use crate::prelude::Repo;
use build::CheckoutBuilder;
use git2::*;

use super::diff::changed_paths;
use super::merge::MergeConflictInfo;
use super::merge::MergeResult;

const TAG: &str = "git:stash";

/// Git's own stash reference. Its reflog *is* the stash list — that is what `git stash list` reads,
/// what `stash_foreach` iterates, and what `stash_drop` rewrites.
const STASH_REF: &str = "refs/stash";

/// What Gramax names its stashes, so one can be told from a `git stash` a person made by hand.
///
/// Git puts it after the branch — the message of a stash reads `On master: gx-stash` — so ours are
/// the ones ending in this, not starting with it.
pub(crate) const GRAMAX_STASH_MESSAGE: &str = "gx-stash";

/// One entry of the `refs/stash` reflog.
#[derive(serde::Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StashInfo {
	pub oid: String,
	pub message: String,
	/// Written by a person at a terminal with `git stash`, and not by Gramax — so not ours to replay.
	pub is_foreign: bool,
}

pub trait StashSave {
	fn stash(&mut self, message: Option<&str>) -> Result<Option<Oid>>;
}

/// Who a stash is signed by when the repository's config does not say.
const GRAMAX_SIGNATURE: (&str, &str) = ("Gramax", "info@gram.ax");

pub trait Stash {
	fn stash_apply(&mut self, oid: Oid) -> Result<MergeResult>;
	fn stash_restore(&mut self, oid: Oid) -> Result<MergeResult>;
	fn stash_list(&self) -> Result<Vec<StashInfo>>;
	fn stash_delete(&mut self, oid: Oid) -> Result<()>;
}

/// Which side of the replay stands for "what is here now".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Ours {
	/// `HEAD`, the way `git stash apply` reads it. The working copy is expected to be at `HEAD`,
	/// because the stash put it there a moment ago.
	Head,
	/// The index. Used when the replay comes after a restart rather than right after the stash: by
	/// then the user has been editing, and every edit is in the index — so the index, not `HEAD`, is
	/// what the stash has to be merged with.
	Index,
}

impl<C: Creds> StashSave for Repo<'_, C> {
	/// Stashes what the index holds, without ever walking the working copy.
	///
	/// `git_stash_save` walks the whole catalog four times; none of it is needed while the index is
	/// the list of changes. What comes out is an ordinary stash — a commit off `HEAD` recorded in the
	/// reflog of `refs/stash` — so `git stash list` and `git stash apply` read it.
	///
	/// Untracked files are neither carried nor destroyed: the reset is scoped to the stashed paths, so
	/// a file the index never heard of is left where it is.
	///
	/// Signed by the repository's own config, and by Gramax when the config is silent. A stash is a
	/// commit that never leaves this machine — it is replayed and dropped — so who signed it is a
	/// label, not a claim, and asking for credentials to write one would mean recovery could not: it
	/// runs while a catalog is being opened, where there is nobody to ask.
	fn stash(&mut self, message: Option<&str>) -> Result<Option<Oid>> {
		info!(target: TAG, "stashing changes");

		let signature = match self.repo().signature() {
			Ok(signature) => signature,
			Err(_) => Signature::now(GRAMAX_SIGNATURE.0, GRAMAX_SIGNATURE.1)?,
		};

		let message = message.unwrap_or(GRAMAX_STASH_MESSAGE).to_owned();

		// A conflicted index cannot be written out as a tree at all, and its entries may be phantom
		// conflicts left from an earlier merge. The caller used to guard against this by resetting the
		// index before every stash, which emptied the very list of changes this reads.
		if self.repo().index()?.has_conflicts() {
			info!(target: TAG, "index has conflicts; resetting it and stashing through libgit2");

			{
				let head_object = self.repo().head()?.peel_to_commit()?.into_object();
				self.repo().reset(&head_object, ResetType::Mixed, None)?;
			}

			return self.stash_through_libgit2(&signature, &message);
		}

		let repo = self.repo();
		let head_ref = repo.head()?;
		let branch = head_ref.shorthand().unwrap_or("HEAD").to_owned();
		let head_commit = head_ref.peel_to_commit()?;
		let head_tree = head_commit.tree()?;

		let index_tree = repo.find_tree(repo.index()?.write_tree()?)?;

		if index_tree.id() == head_tree.id() {
			info!(target: TAG, "tried to stash but there is nothing to stash");
			return Ok(None);
		}

		// The reset below returns these paths to `HEAD`, so whatever is on disk at them has to be in the
		// stash first: a file can be written again between entering the index and being stashed.
		let index_tree = self.refresh_index_at(&changed_paths(repo, &head_tree, &index_tree)?, index_tree)?;

		if index_tree.id() == head_tree.id() {
			info!(target: TAG, "tried to stash but there is nothing to stash");
			return Ok(None);
		}

		// The shape git gives a stash: an "index on ..." commit off `HEAD`, then the stash commit with
		// both as parents. Both carry the same tree here, as `git stash` does when everything is staged.
		let index_commit = repo.find_commit(repo.commit(
			None,
			&signature,
			&signature,
			&format!("index on {branch}: {message}"),
			&index_tree,
			&[&head_commit],
		)?)?;

		let stash_message = format!("On {branch}: {message}");
		let stash_oid = repo.commit(None, &signature, &signature, &stash_message, &index_tree, &[&head_commit, &index_commit])?;

		// `refs/stash` is not logged by default, and the reflog entry is what puts the stash in the list.
		repo.reference_ensure_log(STASH_REF)?;
		repo.reference(STASH_REF, stash_oid, true, &stash_message)?;

		self.reset_paths_between(&index_tree, &head_tree)?;

		info!(target: TAG, "created stash with oid {stash_oid}: {message}");
		Ok(Some(stash_oid))
	}
}

impl<C: Creds> Stash for Repo<'_, C> {
	/// Puts a stash back by merging three trees, none of which is read from disk: the stash's own
	/// parent against `HEAD` against the stash — the three sides `git stash apply` uses. Only the paths
	/// the merge changes are written, so the cost follows the stash rather than the catalog.
	///
	/// Nothing here is specific to the stashes this crate writes; one made by `git stash` in a terminal
	/// replays the same way, and its third parent carries the untracked files it took.
	fn stash_apply(&mut self, oid: Oid) -> Result<MergeResult> {
		self.replay_stash(oid, Ours::Head)
	}

	/// Puts a stash back long after it was taken — the operation carrying it died, and the app has been
	/// restarted since.
	///
	/// The difference from `stash_apply` is which side stands for "what is here now". Right after a
	/// stash that is `HEAD`: the working copy was just reset to it. After a restart it is the index,
	/// because the user has been editing in between and every edit went into the index. Merging against
	/// `HEAD` there would call those edits nothing and refuse to write over them; merging against the
	/// index makes them a side of the merge, so what cannot be reconciled comes back as a conflict the
	/// user resolves instead of an error nobody can act on.
	fn stash_restore(&mut self, oid: Oid) -> Result<MergeResult> {
		self.replay_stash(oid, Ours::Index)
	}

	/// The `refs/stash` reflog, newest first — the same list `git stash list` prints.
	///
	/// Read rather than iterated with `stash_foreach`, which wants the repository mutably: the list is
	/// wanted while opening a catalog, and opening one takes no write lock.
	fn stash_list(&self) -> Result<Vec<StashInfo>> {
		let Ok(reflog) = self.repo().reflog(STASH_REF) else {
			// No reference means no stash has ever been taken here.
			return Ok(vec![]);
		};

		// An entry whose commit is gone is not a stash any more. Only the newest is held by the
		// reference itself, so `gc` is free to collect an older one — and a caller walking this list to
		// replay what it finds would stop at the first oid that no longer resolves, taking everything
		// after it down with it.
		let stashes = reflog
			.iter()
			.filter(|entry| self.repo().find_commit(entry.id_new()).is_ok())
			.map(|entry| {
				let message = entry.message().unwrap_or_default().to_owned();
				StashInfo {
					oid: entry.id_new().to_string(),
					is_foreign: !message.ends_with(GRAMAX_STASH_MESSAGE),
					message,
				}
			})
			.collect();

		Ok(stashes)
	}

	/// Drops a stash. One that is already gone is not an error — recovery paths reach this twice, and
	/// the outcome they asked for has happened.
	fn stash_delete(&mut self, oid: Oid) -> Result<()> {
		info!(target: TAG, "deleting stash");

		let Some(index) = self.stash_position(oid)? else {
			info!(target: TAG, "stash {oid} is already gone; nothing to delete");
			return Ok(());
		};

		self.repo_mut().stash_drop(index)?;
		Ok(())
	}
}

/// Refuses, naming the paths, if the working copy at any of them is not what `ours` says it is.
///
/// The write that follows is forced, and forcing does not ask; a safe write does not ask either,
/// because `allow_conflicts` turns "may not touch this" into "skip it" and the stash would be
/// reported as applied without having been written. So the question is asked here.
///
/// What counts as "not what `ours` says" follows the side being merged against. Against `HEAD`, a
/// path staged with something else is already a change the stash would bury, so a staged difference
/// counts as well as an unstaged one. Against the index, staged *is* `ours`, and only what the index
/// has not seen is in the way.
fn refuse_if_dirty(repo: &Repository, paths: &[PathBuf], ours: Ours) -> Result<()> {
	let unseen = Status::WT_NEW | Status::WT_MODIFIED | Status::WT_DELETED | Status::WT_TYPECHANGE | Status::WT_RENAMED;

	let staged = Status::INDEX_NEW | Status::INDEX_MODIFIED | Status::INDEX_DELETED | Status::INDEX_TYPECHANGE | Status::INDEX_RENAMED;

	let in_the_way = match ours {
		Ours::Head => unseen | staged,
		Ours::Index => unseen,
	};

	let blocking = paths
		.iter()
		.filter(|path| repo.status_file(path).is_ok_and(|status| status.intersects(in_the_way)))
		.map(|path| path.display().to_string())
		.collect::<Vec<_>>();

	if blocking.is_empty() {
		return Ok(());
	}

	warn!(target: TAG, "stash apply refused; blocked by {}", blocking.join(", "));
	Err(
		Error::new(
			ErrorCode::Conflict,
			ErrorClass::Checkout,
			format!("local changes would be overwritten by the stash: {}", blocking.join(", ")),
		)
		.into(),
	)
}

impl<C: Creds> Repo<'_, C> {
	/// The stash libgit2 makes, for the one case the fast path cannot serve.
	fn stash_through_libgit2(&mut self, signature: &Signature, message: &str) -> Result<Option<Oid>> {
		let flags = StashFlags::DEFAULT | StashFlags::INCLUDE_UNTRACKED;

		match self.repo_mut().stash_save(signature, message, Some(flags)) {
			Ok(oid) => {
				info!(target: TAG, "created libgit2 stash with oid {oid}: {message}");
				Ok(Some(oid))
			}
			Err(e) if e.code() == ErrorCode::NotFound && e.class() == ErrorClass::Stash => {
				info!(target: TAG, "tried to stash but there is nothing to stash");
				Ok(None)
			}
			Err(e) => Err(e.into()),
		}
	}

	fn replay_stash(&mut self, oid: Oid, ours: Ours) -> Result<MergeResult> {
		info!(target: TAG, "applying stash against {ours:?}");

		let repo = self.repo();
		let stash_commit = repo.find_commit(oid)?;

		let stash_tree = stash_commit.tree()?;
		let base_tree = stash_commit.parent(0)?.tree()?;
		let ours_tree = match ours {
			Ours::Head => repo.head()?.peel_to_commit()?.tree()?,
			Ours::Index => repo.find_tree(repo.index()?.write_tree()?)?,
		};

		let mut merge_opts = MergeOptions::new();
		merge_opts.find_renames(true);

		let mut merged = repo.merge_trees(&base_tree, &ours_tree, &stash_tree, Some(&merge_opts))?;

		let mut checkout_opts = CheckoutBuilder::default();
		checkout_opts
			.allow_conflicts(true)
			.conflict_style_merge(true)
			.our_label("Updated upstream")
			.their_label("Stashed changes")
			.update_index(true);

		// Safe, not forced: the paths this writes were emptied by the stash, so there is nothing to
		// refuse — and when there is, something appeared at them meanwhile. `git stash apply` refuses
		// in exactly that case, and so should this, rather than overwriting it unannounced.
		checkout_opts.safe();

		if merged.has_conflicts() {
			let mut conflicts = vec![];
			for conflict in merged.conflicts()? {
				conflicts.push(MergeConflictInfo::from(conflict?))
			}

			// The conflicted paths are the only ones this may overwrite.
			let conflicted: HashSet<PathBuf> = conflicts
				.iter()
				.flat_map(|conflict| {
					[&conflict.ours, &conflict.theirs, &conflict.ancestor]
						.into_iter()
						.flatten()
						.map(PathBuf::from)
				})
				.collect();

			// Only what this apply can touch. Checking out the whole merged index would write every other
			// path it holds, reverting anything edited while the synchronisation ran. From tree diffs,
			// because a conflicted index has no tree.
			let mut clean: Vec<PathBuf> = changed_paths(repo, &base_tree, &stash_tree)?;
			clean.extend(changed_paths(repo, &ours_tree, &stash_tree)?);
			clean.retain(|path| !conflicted.contains(path));

			// The write is forced, since a conflict marker never merges cleanly with what is on disk — and
			// forcing reaches the non-conflicted paths too. So an edit made at one of them while the
			// operation ran would be lost because something *else* conflicted. `git stash apply` refuses
			// here, and so does this, before writing anything.
			refuse_if_dirty(repo, &clean, ours)?;

			for path in clean.iter().chain(conflicted.iter()) {
				checkout_opts.path(path);
			}

			// One checkout for both groups, not one each: the merged index carries rename records that
			// point at its own entries, and a first pass with `update_index` rewrites those entries — the
			// second pass then fails on a NAME entry whose ancestor is no longer there.
			checkout_opts.force();
			repo.checkout_index(Some(&mut merged), Some(&mut checkout_opts))?;

			// Resolving the conflict drops the stash, and anything still inside would go with it.
			self.restore_untracked_of(&stash_commit)?;

			info!(target: TAG, "stash applied with {} conflicts; oid: {oid}", conflicts.len());
			return Ok(MergeResult::Conflicts(conflicts));
		}

		// Without conflicts the merged index has a tree, and its diff names every path to touch.
		let merged_tree = repo.find_tree(merged.write_tree_to(repo)?)?;
		let paths = changed_paths(repo, &ours_tree, &merged_tree)?;

		// A safe checkout does not refuse here — `allow_conflicts` is on, which is what lets the
		// conflicted branch above write markers, and it turns a path it may not touch into one it
		// silently skips. The stash then reports success while its content never reached the disk, and
		// the caller drops the stash. So the question is asked here instead, and answered out loud.
		refuse_if_dirty(repo, &paths, ours)?;

		// Safe measures the working copy against `HEAD`, and after a restart `HEAD` is not what the
		// working copy was built from — the pull that ran in between moved it, and the user has been
		// editing since. Every path would look like it was about to be overwritten. Nothing is: the
		// check above just established that the disk holds what the index holds.
		if ours == Ours::Index {
			checkout_opts.force();
		}

		for path in paths {
			checkout_opts.path(path);
		}

		repo.checkout_tree(merged_tree.as_object(), Some(&mut checkout_opts))?;

		let mut index = repo.index()?;
		index.read_tree(&merged_tree)?;
		index.write()?;

		self.restore_untracked_of(&stash_commit)?;

		info!(target: TAG, "stash applied w/o conflicts; oid: {oid}");
		Ok(MergeResult::Ok)
	}
}

impl<C: Creds> Repo<'_, C> {
	/// Re-reads the given paths from disk into the index and returns the tree that comes out.
	///
	/// A path gone from disk is dropped from the index rather than failing: a deletion is a change to
	/// stash like any other, and `add_path` on a missing file is an error.
	fn refresh_index_at<'r>(&'r self, paths: &[PathBuf], current: Tree<'r>) -> Result<Tree<'r>> {
		let repo = self.repo();
		let Some(workdir) = repo.workdir() else { return Ok(current) };

		let mut index = repo.index()?;
		let mut touched = false;

		for path in paths {
			if workdir.join(path).exists() {
				index.add_path(path)?;
			} else if index.get_path(path, 0).is_some() {
				index.remove_path(path)?;
			} else {
				continue;
			}

			touched = true;
		}

		if !touched {
			return Ok(current);
		}

		// Built from the index in memory; the file on disk is left alone, because the reset that follows
		// rewrites it anyway and every extra write is a window for a reader to find it mid-replace.
		Ok(repo.find_tree(index.write_tree()?)?)
	}

	/// Where a stash sits in the reflog of `refs/stash`, or `None` if the repository has no such stash.
	fn stash_position(&mut self, oid: Oid) -> Result<Option<usize>> {
		let mut index = None;

		self.repo_mut().stash_foreach(|stash_index, _, stash_oid| {
			if stash_oid.cmp(&oid).is_eq() {
				index = Some(stash_index);
				return false;
			}
			true
		})?;

		Ok(index)
	}

	/// Puts back the untracked files a stash carried. Only `git stash --include-untracked` makes that
	/// third parent; the stashes written here never do.
	fn restore_untracked_of(&self, stash_commit: &Commit) -> Result<()> {
		if stash_commit.parent_count() < 3 {
			return Ok(());
		}

		let untracked_tree = stash_commit.parent(2)?.tree()?;
		let mut paths = vec![];

		untracked_tree.walk(TreeWalkMode::PreOrder, |root, entry| {
			if entry.kind() == Some(ObjectType::Blob) {
				if let Some(name) = entry.name() {
					paths.push(PathBuf::from(root).join(name));
				}
			}
			TreeWalkResult::Ok
		})?;

		if paths.is_empty() {
			return Ok(());
		}

		let mut opts = CheckoutBuilder::new();
		opts.force().update_index(false);
		for path in &paths {
			opts.path(path);
		}

		info!(target: TAG, "restoring {} untracked files carried by the stash", paths.len());
		self.repo().checkout_tree(untracked_tree.as_object(), Some(&mut opts))?;
		Ok(())
	}

	/// Returns the working copy to `tree` at the paths where it differs from `from`, and nowhere else.
	fn reset_paths_between(&self, from: &Tree, tree: &Tree) -> Result<()> {
		let repo = self.repo();

		let mut opts = CheckoutBuilder::new();
		opts.force().update_index(true);

		let paths = changed_paths(repo, from, tree)?;
		let count = paths.len();
		for path in paths {
			opts.path(path);
		}

		info!(target: TAG, "resetting {count} paths");
		repo.checkout_tree(tree.as_object(), Some(&mut opts))?;
		Ok(())
	}
}
