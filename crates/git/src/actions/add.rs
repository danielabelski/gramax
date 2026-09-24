use std::path::Path;
use std::path::PathBuf;

use git2::*;

use crate::creds::Creds;
use crate::error::Result;
use crate::prelude::*;

const TAG: &str = "git:add";

pub trait Add {
	fn add_all(&self) -> Result<()>;
	fn add<P: AsRef<Path>>(&self, path: P) -> Result<()>;
	fn add_glob<S: IntoCString + AsRef<Path>>(&self, patterns: Vec<S>) -> Result<()>;
	fn add_glob_force<S: IntoCString + AsRef<Path>>(&self, patterns: Vec<S>) -> Result<()>;
}

impl<C: Creds> Add for Repo<'_, C> {
	fn add_all(&self) -> Result<()> {
		self.add_glob(vec!["."])
	}

	fn add<P: AsRef<Path>>(&self, path: P) -> Result<()> {
		self.0.index()?.add_path(path.as_ref())?;
		self.0.index()?.write()?;
		Ok(())
	}

	fn add_glob<S: IntoCString + AsRef<Path>>(&self, patterns: Vec<S>) -> Result<()> {
		use std::collections::HashSet;

		self.ensure_crlf_configured()?;

		let mut index = self.0.index()?;

		let conflicts = index
			.conflicts()?
			.filter_map(|i| i.ok().and_then(|i| i.our))
			.filter_map(|i| String::from_utf8(i.path).ok())
			.map(PathBuf::from)
			.collect::<HashSet<_>>();

		info!(target: TAG, "add {} paths; {} conflicts", patterns.len(), conflicts.len());

		let use_add_all = is_whole_workdir(&patterns);

		let is_conflict = |path: &Path| -> bool {
			if conflicts.contains(path) {
				warn!(target: TAG, "skipping path '{}' due to conflicts", path.display());
				return true;
			}
			false
		};

		let mut cb = |path: &Path, _: &[u8]| is_conflict(path) as i32;

		if use_add_all {
			info!(target: TAG, "using add_all since `.` or '*' was provided");
			index.add_all(patterns.into_iter(), IndexAddOption::DEFAULT, Some(&mut cb))?;
			index.write()?;
			return Ok(());
		}

		let workdir_path = self.0.workdir().ok_or(crate::error::Error::NoWorkdir)?;

		let mut del_pathspecs = vec![];
		for path in patterns.iter().filter(|p| !is_conflict(p.as_ref())) {
			let absolute_path = workdir_path.join(path.as_ref());

			// Asked about the path itself, not about what it points at — same reason as in
			// `add_glob_force` below.
			if absolute_path.symlink_metadata().is_ok() {
				add_all(&mut index, workdir_path, &absolute_path)?;
			} else {
				del_pathspecs.push(path.as_ref());
			}
		}

		if !del_pathspecs.is_empty() {
			index.remove_all(del_pathspecs, None)?;
		}

		index.write()?;
		Ok(())
	}

	fn add_glob_force<S: IntoCString + AsRef<Path>>(&self, patterns: Vec<S>) -> Result<()> {
		info!(target: TAG, "add files without conflict check: {:?}", patterns.iter().map(|s| s.as_ref().display()).collect::<Vec<_>>());

		let mut index = self.0.index()?;

		if is_whole_workdir(&patterns) {
			info!(target: TAG, "using add_all since `.` or `*` was provided");
			index.add_all(patterns.into_iter(), IndexAddOption::DEFAULT, None)?;
			index.write()?;
			return Ok(());
		}

		let workdir_path = self.0.workdir().ok_or(crate::error::Error::NoWorkdir)?;

		let mut del_pathspecs = vec![];
		for path in patterns.iter() {
			let absolute_path = workdir_path.join(path.as_ref());

			// `exists` follows the link and asks about its target, so a symlink whose target is gone
			// reads as "no such path" and would be staged as a deletion — while git tracks the link
			// itself, which is still there. `symlink_metadata` asks about the path as it is.
			if absolute_path.symlink_metadata().is_ok() {
				add_all_not_ignored(self.repo(), &mut index, workdir_path, &absolute_path)?;
			} else {
				del_pathspecs.push(path.as_ref());
			}
		}

		if !del_pathspecs.is_empty() {
			index.remove_all(del_pathspecs, None)?;
		}

		index.write()?;
		Ok(())
	}
}

/// `.` and `*` mean "everything in the working copy" — the only case where a full
/// workdir diff is what the caller actually asked for.
fn is_whole_workdir<S: AsRef<Path>>(patterns: &[S]) -> bool {
	let [pattern] = patterns else { return false };
	pattern.as_ref() == Path::new(".") || pattern.as_ref() == Path::new("*")
}

fn add_all(index: &mut Index, workdir_path: &Path, path: &Path) -> Result<()> {
	if !path.is_dir() {
		let Ok(relative_path) = path.strip_prefix(workdir_path) else {
			return Ok(());
		};

		index.add_path(relative_path)?;
		return Ok(());
	}

	for entry in std::fs::read_dir(path)? {
		let path = entry?.path();

		add_all(index, workdir_path, &path)?;
	}

	Ok(())
}

/// Same as [`add_all`], but keeps the `.gitignore` behaviour of `index.add_all` with
/// [`IndexAddOption::DEFAULT`]: an ignored path is skipped unless it is already tracked.
fn add_all_not_ignored(repo: &Repository, index: &mut Index, workdir_path: &Path, path: &Path) -> Result<()> {
	if !path.is_dir() {
		let Ok(relative_path) = path.strip_prefix(workdir_path) else {
			return Ok(());
		};

		// Every stage, not only 0: a conflicted entry lives in stages 1-3 and has no stage 0 at all, so
		// asking about 0 alone would call a conflicted file untracked — and an ignored one would then be
		// skipped, losing the resolution the caller just wrote.
		let tracked = (0..=3).any(|stage| index.get_path(relative_path, stage).is_some());

		if repo.is_path_ignored(relative_path)? && !tracked {
			info!(target: TAG, "skipping ignored path '{}'", relative_path.display());
			return Ok(());
		}

		index.add_path(relative_path)?;
		return Ok(());
	}

	for entry in std::fs::read_dir(path)? {
		let path = entry?.path();

		add_all_not_ignored(repo, index, workdir_path, &path)?;
	}

	Ok(())
}
