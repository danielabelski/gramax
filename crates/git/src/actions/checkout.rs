use super::diff::changed_paths;
use super::diff::name_what_blocks;
use crate::creds::ActualCreds;
use crate::error::OrUtf8Err;
use crate::ext::lfs::Lfs;
use crate::repo::Repo;
use crate::Result;

use git2::build::CheckoutBuilder;
use git2::*;

pub trait Checkout {
	fn checkout(&self, branch_name: &str, force: bool) -> Result<()>;
}

const TAG: &str = "git:checkout";

impl<C: ActualCreds> Checkout for Repo<'_, C> {
	fn checkout(&self, branch_name: &str, force: bool) -> Result<()> {
		let branch = match self.0.find_branch(branch_name, BranchType::Local) {
			Ok(b) => b,
			Err(err) if err.code() == ErrorCode::NotFound && err.class() == ErrorClass::Reference => {
				let remote_ref = self.0.find_reference(&format!("refs/remotes/origin/{branch_name}"))?;
				let mut branch = self.0.branch(branch_name, &remote_ref.peel_to_commit()?, false)?;
				branch.set_upstream(Some(&format!("origin/{branch_name}")))?;
				branch
			}
			Err(err) => return Err(err.into()),
		};

		let mut opts = CheckoutBuilder::new();
		if force {
			opts.force();
		}

		let tree = branch.get().peel_to_tree()?;

		if !self.is_lazy_lfs_enabled()? {
			self.pull_lfs_objects_by_tree(&tree, None, crate::cancel_token::CancelToken::NeverCancel)?;
		} else {
			debug!(target: TAG, "lfs pulling is lazy; skipping");
		}

		info!("checking out to {}", branch.get().name().or_utf8_err()?);

		if !self.0.is_bare() {
			// Narrowed only when the checkout is not forced. A pathspec keeps `checkout_get_actions` off
			// every path outside it, so a forced checkout would stop discarding local edits in files the
			// two trees agree about — and forced is asked for precisely to leave nothing behind
			// (`MergeRequestCommands.afterSync`, moving off a branch that no longer exists upstream).
			// Switching branches from the interface does not force, so the cold checkout stays narrow.
			if force {
				self.0.checkout_tree(tree.as_object(), Some(&mut opts))?;
			} else {
				self.checkout_paths_between_head_and(&tree, &mut opts)?;
			}
		}

		self.0.set_head(branch.get().name().or_utf8_err()?)?;

		Ok(())
	}
}

impl<C: ActualCreds> Repo<'_, C> {
	/// Writes the target tree at the paths where it differs from `HEAD`, and nowhere else.
	///
	/// A checkout of the whole tree writes no more files than this one does — libgit2 skips what
	/// already matches — but it reaches that answer by walking the working copy: the list of actions
	/// is built by iterating it (`checkout.c`, `checkout_get_actions`). On a browser filesystem that
	/// walk is the whole cost of switching branches, and it does not depend on how much the branches
	/// differ. A pathspec keeps the iterators off everything the two trees agree about.
	///
	/// Called while `HEAD` still points at the branch being left — `set_head` runs after the working
	/// copy has been written — because `HEAD` is one side of the diff.
	fn checkout_paths_between_head_and(&self, target: &Tree, opts: &mut CheckoutBuilder) -> Result<()> {
		let Ok(head_tree) = self.0.head().and_then(|head| head.peel_to_tree()) else {
			// No `HEAD` to diff against — an unborn branch or a fresh clone. Nothing to scope by.
			info!(target: TAG, "no head to compare against; checking out the whole tree");
			self.0.checkout_tree(target.as_object(), Some(opts))?;
			return Ok(());
		};

		let paths = changed_paths(&self.0, &head_tree, target)?;

		if paths.is_empty() {
			info!(target: TAG, "the trees agree; nothing to write");
			return Ok(());
		}

		info!(target: TAG, "checking out {} changed paths", paths.len());
		for path in &paths {
			opts.path(path);
		}

		// The same translation the merge checkout does: a branch switch refused over a local edit has
		// to say which file, or the user is told a number and left to guess.
		name_what_blocks(&self.0, self.0.checkout_tree(target.as_object(), Some(opts)), &paths)
	}
}
