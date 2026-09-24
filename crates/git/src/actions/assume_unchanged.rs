
use crate::creds::Creds;
use crate::error::Result;
use crate::prelude::Repo;

const TAG: &str = "git:assume-unchanged";

/// `GIT_INDEX_ENTRY_VALID` — git's "assume unchanged" bit, checked before any metadata is compared
/// (`diff_generate.c`, `diff_delta__from_one` and `maybe_modified`).
const ASSUME_UNCHANGED: u16 = git2::IndexEntryFlag::VALID.bits();

/// The stage of an entry lives in the same flags word; anything above zero is a conflict side.
const STAGE_MASK: u16 = git2::raw::GIT_INDEX_ENTRY_STAGEMASK;

pub trait AssumeUnchanged {
	fn assume_unchanged_all(&self) -> Result<usize>;
	fn assume_unchanged_if_sole_writer(&self) -> Result<usize>;
	fn forget_assume_unchanged(&self) -> Result<usize>;
}

impl<C: Creds> AssumeUnchanged for Repo<'_, C> {
	/// Tells git that the working copy holds what the index says, so it stops reading files to check.
	///
	/// Only true where Gramax is the only writer — the browser, where OPFS is private to the origin.
	/// There every write goes into the index as it is made, so nothing is ever behind the index; and
	/// staging writes a fresh entry, which clears the mark on exactly the paths that changed.
	///
	/// What it buys: `lstat` in WASMFS reports an inode built from a pointer and an mtime set when the
	/// file object was constructed, so after a page reload nothing matches what the index recorded and
	/// git re-reads every file it walks. The bit is consulted first, so the lie is never reached.
	///
	/// Conflicted entries are left alone: their sides are not a statement about the working copy.
	fn assume_unchanged_all(&self) -> Result<usize> {
		let repo = self.repo();
		let mut index = repo.index()?;

		// Nothing to mark is the usual case: the mark is put on before every write, and an operation
		// leaves entries unmarked only where it rewrote them. Walking the flags costs nothing; the diff
		// below and the index write are what cost, so neither is done unless there is work.
		if index.iter().all(|entry| entry.flags & (STAGE_MASK | ASSUME_UNCHANGED) != 0) {
			return Ok(0);
		}

		// Everything the index holds that `HEAD` does not — the changes waiting to be published. The bit
		// must not go near them: libgit2 drops a delta for a marked entry outright when the path exists
		// on one side only (`diff_generate.c`, `diff_delta__from_one`), and that is the same code the
		// `HEAD`-to-index diff runs through. A marked new file disappears from the list of changes, and
		// what is not in the list is never committed.
		let staged = staged_paths(repo, &index)?;

		let mut marked = 0;
		for position in 0..index.len() {
			let Some(mut entry) = index.get(position) else { continue };

			if entry.flags & (STAGE_MASK | ASSUME_UNCHANGED) != 0 || staged.contains(&entry.path) {
				continue;
			}

			entry.flags |= ASSUME_UNCHANGED;
			index.add(&entry)?;
			marked += 1;
		}

		if marked == 0 {
			return Ok(0);
		}

		index.write()?;

		info!(target: TAG, "marked {marked} index entries assume-unchanged");
		Ok(marked)
	}

	/// Takes every mark off, for the moments when `HEAD` moves and the index does not follow.
	///
	/// A mark is only ever put on a path `HEAD` and the index agree about. Move `HEAD` underneath and
	/// that stops being true: the path becomes one-sided, and a one-sided delta on a marked entry is
	/// dropped whole — the change disappears from what the app lists and is never committed.
	fn forget_assume_unchanged(&self) -> Result<usize> {
		let repo = self.repo();
		let mut index = repo.index()?;

		let mut forgotten = 0;
		for position in 0..index.len() {
			let Some(mut entry) = index.get(position) else { continue };

			if entry.flags & ASSUME_UNCHANGED == 0 {
				continue;
			}

			entry.flags &= !ASSUME_UNCHANGED;
			index.add(&entry)?;
			forgotten += 1;
		}

		if forgotten == 0 {
			return Ok(0);
		}

		index.write()?;

		info!(target: TAG, "took the mark off {forgotten} index entries");
		Ok(forgotten)
	}

	/// The same, where the claim the mark makes is true.
	///
	/// That is the browser and nowhere else: OPFS is private to the origin, so Gramax is the only
	/// process that can write into the working copy. Desktop has VS Code, a terminal and a file
	/// manager pointed at the same folder, and there the working copy is the source of truth — the
	/// watcher reports what changed, and a stale index would hide the user's own edits.
	fn assume_unchanged_if_sole_writer(&self) -> Result<usize> {
		if !cfg!(target_arch = "wasm32") {
			return Ok(0);
		}

		self.assume_unchanged_all()
	}
}

/// Paths where the index and `HEAD` disagree — what the user has staged and not yet published.
///
/// Read from the index and the commit trees; no file is opened. On an unborn branch there is no
/// `HEAD` to compare with, so everything the index holds is staged.
fn staged_paths(repo: &git2::Repository, index: &git2::Index) -> Result<std::collections::HashSet<Vec<u8>>> {
	let head_tree = match repo.head().and_then(|head| head.peel_to_tree()) {
		Ok(tree) => Some(tree),
		Err(_) => None,
	};

	let diff = repo.diff_tree_to_index(head_tree.as_ref(), Some(index), None)?;

	let mut paths = std::collections::HashSet::new();
	for delta in diff.deltas() {
		for path in [delta.old_file().path(), delta.new_file().path()].into_iter().flatten() {
			paths.insert(path.as_os_str().as_encoded_bytes().to_vec());
		}
	}

	Ok(paths)
}
