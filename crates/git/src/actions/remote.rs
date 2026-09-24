use std::rc::Rc;

use git2::*;

use crate::cancel_token::CancelToken;
use crate::creds::ActualCreds;
use crate::creds::Creds;
use crate::error::OrUtf8Err;
use crate::error::Result;
use crate::ext::lfs::Lfs;
use crate::prelude::*;
use crate::remote_callback::*;
use crate::remote_progress::CreateRemoteTransferCallbacks;
use crate::remote_progress::RemoteProgressCallback;
use crate::ShortPathExt;

const TAG: &str = "git:remote";

#[derive(serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RemoteOptions<'c> {
	pub cancel_token: CancelToken<'c>,
	pub force: bool,
}

impl std::fmt::Debug for RemoteOptions<'_> {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.debug_struct("RemoteOptions")
			.field("cancel_token", &self.cancel_token)
			.field("force", &self.force)
			.finish()
	}
}

impl Default for RemoteOptions<'_> {
	fn default() -> Self {
		Self {
			cancel_token: 0.into(),
			force: false,
		}
	}
}

impl<'c> RemoteOptions<'c> {
	pub fn new<C: Into<CancelToken<'c>>>(cancel_token: C) -> Self {
		Self {
			cancel_token: cancel_token.into(),
			force: false,
		}
	}

	pub fn force(self) -> Self {
		Self { force: true, ..self }
	}
}

pub trait RemoteConnect {
	fn fetch<'c>(&self, opts: RemoteOptions<'c>, on_progress: RemoteProgressCallback<'c>) -> Result<()>;
	fn push<'c>(&self, opts: RemoteOptions<'c>, on_progress: RemoteProgressCallback<'c>) -> Result<()>;
	fn debug_push(&self) -> Result<()>;

	fn can_fetch(&self) -> Result<bool>;
	fn can_push(&self) -> Result<bool>;
	fn ensure_remote_connected(&self, remote: &mut git2::Remote, direction: Direction) -> Result<()>;
}

pub trait Remote {
	fn add_remote<S: AsRef<str>, U: AsRef<str>>(&self, name: S, url: U) -> Result<()>;
	fn get_remote(&self) -> Result<Option<String>>;
	fn has_remotes(&self) -> Result<bool>;
}

impl<C: ActualCreds> RemoteConnect for Repo<'_, C> {
	fn debug_push(&self) -> Result<()> {
		self.push(RemoteOptions::default(), Rc::new(|_| {}))
	}

	fn push<'c>(&self, opts: RemoteOptions<'c>, on_progress: RemoteProgressCallback<'c>) -> Result<()> {
		let RemoteOptions { force, cancel_token } = opts;
		let cbs = self.create_remote_transfer_callbacks(cancel_token.clone(), on_progress.clone());

		if force {
			warn!(target: TAG, "`force` option is ignored for push");
		}

		let mut push_opts = PushOptions::new();
		push_opts.remote_callbacks(cbs);
		push_opts.follow_redirects(RemoteRedirect::All);
		push_opts.add_credentials_headers(&self.1);
		push_opts.proxy_options(create_proxy_options());

		self.ensure_objects_dir_exists()?;

		let head = self.0.head()?;
		let mut remote = self.ensure_remote_has_postfix(self.0.find_remote("origin")?)?;

		let mut local_branch = self.0.find_branch(head.shorthand().or_utf8_err()?, BranchType::Local)?;
		self.track_remote_branch_of_same_name(&mut local_branch)?;

		self.push_lfs_objects(
			&remote,
			make_lfs_callback(on_progress.clone(), cancel_token.clone()),
			cancel_token.clone(),
		)?;

		let refspec = head.name().or_utf8_err()?;

		info!(target: TAG, "pushing refspecs: {refspec}");
		remote.push(&[refspec], Some(&mut push_opts))?;

		self.track_remote_branch_of_same_name(&mut local_branch)?;

		drop(cancel_token);
		Ok(())
	}

	fn fetch<'c>(&self, opts: RemoteOptions<'c>, on_progress: RemoteProgressCallback<'c>) -> Result<()> {
		let RemoteOptions { force, cancel_token } = opts;

		let cbs = self.create_remote_transfer_callbacks(cancel_token.clone(), on_progress.clone());

		let mut opts = FetchOptions::new();
		opts.remote_callbacks(cbs);
		opts.add_credentials_headers(&self.1);
		opts.follow_redirects(RemoteRedirect::All);
		opts.prune(FetchPrune::On);
		opts.download_tags(AutotagOption::All);
		opts.proxy_options(create_proxy_options());

		let mut remote = self.ensure_remote_has_postfix(self.0.find_remote("origin")?)?;
		self.ensure_objects_dir_exists()?;

		let refspec = match force {
			true => ["+refs/*:refs/*"],
			false => ["refs/heads/*:refs/remotes/origin/*"],
		};

		let repo_path = self.0.path().parent().unwrap_or_else(|| self.0.path()).short();

		info!(target: TAG, "fetching refspec: {refspec:?} ({repo_path})");

		remote.fetch(&refspec, Some(&mut opts), None)?;

		let head = self.0.head().ok().filter(|head| head.is_branch());
		if let Some(head_name) = head.as_ref().and_then(|head| head.shorthand()) {
			self.track_remote_branch_of_same_name(&mut self.0.find_branch(head_name, BranchType::Local)?)?;
		}

		if !self.is_lazy_lfs_enabled()? {
			self.pull_lfs_objects_by_head(make_lfs_callback(on_progress.clone(), cancel_token.clone()), cancel_token.clone())?;
		} else {
			debug!(target: TAG, "lfs pulling is lazy; skipping");
		}

		debug!(target: TAG, "fetched successfully: {refspec:?}");

		drop(cancel_token);
		Ok(())
	}

	fn can_push(&self) -> Result<bool> {
		let mut remote = self.0.find_remote("origin")?;
		Ok(self.ensure_remote_connected(&mut remote, Direction::Push).is_ok())
	}

	fn can_fetch(&self) -> Result<bool> {
		let mut remote = self.0.find_remote("origin")?;
		Ok(self.ensure_remote_connected(&mut remote, Direction::Fetch).is_ok())
	}

	fn ensure_remote_connected(&self, remote: &mut git2::Remote, direction: Direction) -> Result<()> {
		if !remote.connected() {
			let cbs = self.create_remote_callbacks();
			remote.connect_auth(direction, Some(cbs), Some(create_proxy_options()))?;
		}

		Ok(())
	}
}

impl<C: Creds> Repo<'_, C> {
	/// Pull merges the upstream, push writes to `origin/<same name>` — the two must be one branch.
	/// The git CLI leaves `origin/master` as the upstream of `git checkout -b feature origin/master`.
	fn track_remote_branch_of_same_name(&self, branch: &mut git2::Branch) -> Result<()> {
		let local_name = branch.name()?.or_utf8_err()?.to_owned();
		let own_remote_name = format!("origin/{local_name}");
		let has_own_remote = self.0.find_branch(&own_remote_name, BranchType::Remote).is_ok();
		let upstream = branch
			.upstream()
			.ok()
			.and_then(|upstream| upstream.name().ok().flatten().map(str::to_owned));

		match (upstream, has_own_remote) {
			(Some(upstream), true) if upstream == own_remote_name => {}
			(None, false) => {}
			(upstream, true) => {
				info!(target: TAG, "branch {local_name} tracked {upstream:?}; tracking {own_remote_name} instead");
				branch.set_upstream(Some(&own_remote_name))?;
			}
			(Some(upstream), false) => {
				warn!(target: TAG, "branch {local_name} tracked another branch {upstream}; tracking nothing until {own_remote_name} exists");
				branch.set_upstream(None)?;
			}
		}

		Ok(())
	}
}

impl<C: Creds> Remote for Repo<'_, C> {
	fn add_remote<S: AsRef<str>, U: AsRef<str>>(&self, name: S, url: U) -> Result<()> {
		info!(target: TAG, "create remote {} pointing to url {}", name.as_ref(), url.as_ref());

		if let Ok(remote) = self.0.find_remote(name.as_ref()) {
			warn!(target: TAG, "remote {} ({}) already exists; deleting it", name.as_ref(), remote.url().or_utf8_err()?);
			self.0.remote_delete(name.as_ref())?;
		}

		self.0.remote(name.as_ref(), url.as_ref())?;
		Ok(())
	}

	fn get_remote(&self) -> Result<Option<String>> {
		let remote = self.0.find_remote("origin")?;
		Ok(remote.url().map(|u| u.to_string()))
	}

	fn has_remotes(&self) -> Result<bool> {
		Ok(!self.0.remotes()?.is_empty())
	}
}
