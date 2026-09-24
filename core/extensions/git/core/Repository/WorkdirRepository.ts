import { getExecutingEnvironment } from "@app/resolveModule/env";
import type { UnsubscribeToken } from "@core/Event/EventEmitter";
import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import GitAttributes from "@core/GitLfs/logic/GitAttributes";
import type GitMergeResult from "@ext/git/actions/MergeConflictHandler/model/GitMergeResult";
import type { GitMergeResultContent } from "@ext/git/actions/MergeConflictHandler/model/GitMergeResultContent";
import MergeConflictCaller from "@ext/git/actions/MergeConflictHandler/model/MergeConflictCaller";
import GitError from "@ext/git/core/GitCommands/errors/GitError";
import GitErrorCode from "@ext/git/core/GitCommands/errors/model/GitErrorCode";
import type { StashInfo } from "@ext/git/core/GitCommands/LibGit2IntermediateCommands";
import type GitStorage from "@ext/git/core/GitStorage/GitStorage";
import type GitVersionControl from "@ext/git/core/GitVersionControl/GitVersionControl";
import type { GitStatus } from "@ext/git/core/GitWatcher/model/GitStatus";
import type GitSourceData from "@ext/git/core/model/GitSourceData.schema";
import GitStash from "@ext/git/core/model/GitStash";
import type { GitVersion } from "@ext/git/core/model/GitVersion";
import Repository, {
	type CheckoutOptions,
	type IsShouldSyncOptions,
	type MergeOptions,
	type PublishOptions,
	type SyncOptions,
	type SyncResult,
} from "@ext/git/core/Repository/Repository";
import RepositoryStateProvider, {
	type RepositoryCheckoutState,
	type RepositoryMergeConflictState,
	type RepositoryStashConflictState,
	type RepositorySyncingState,
} from "@ext/git/core/Repository/state/RepositoryState";
import { Level, span, trace } from "@ext/loggers/opentelemetry";
import isGitSourceType from "@ext/storage/logic/SourceDataProvider/logic/isGitSourceType";
import type SourceData from "@ext/storage/logic/SourceDataProvider/model/SourceData";
import type Storage from "@ext/storage/logic/Storage";
import { FileStatus } from "@ext/Watchers/model/FileStatus";

type PullResult = {
	mergeFiles: GitMergeResultContent[];
	mergeConflict: boolean;
};

export default class WorkdirRepository extends Repository {
	private _getRepositoryStateFirstly = true;
	private _state: RepositoryStateProvider;
	private _unsubscribeTokens: UnsubscribeToken[] = [];
	private _stagingPaused = false;
	private _stagingBuffer: Path[] = [];

	/**
	 * Everything staged so far, as one chain.
	 *
	 * The file provider's events are fired and not awaited, so a write reaches the index some time
	 * after it reaches the disk. Anything that reads the index as the list of changes — the stash
	 * above all — has to be able to wait for that, or it decides there is nothing to put aside while
	 * the edit is still on its way.
	 */
	private _staging: Promise<void> = Promise.resolve();

	constructor(
		repoPath: Path,
		fp: FileProvider,
		gvc: GitVersionControl,
		storage: Storage,
		disableMergeRequests?: boolean,
	) {
		super(repoPath, fp, gvc, storage, disableMergeRequests);
		this._state = new RepositoryStateProvider(this, this._repoPath, this._fp);
	}

	@trace({ level: Level.Full })
	subscribeFpEvents() {
		if (!(this._fp instanceof MountFileProvider && this._fp.default() instanceof DiskFileProvider)) return;
		if (!this._gvc) return;

		this._unsubscribeTokens.push(
			DiskFileProvider.events.on("write", (e) => this._gitIndexAddFiles([e.path])),
			DiskFileProvider.events.on("move", (e) => this._gitIndexAddFiles([e.from, e.to])),
			DiskFileProvider.events.on("copy", (e) => this._gitIndexAddFiles([e.from, e.to])),
			DiskFileProvider.events.on("delete", (e) => this._gitIndexAddFiles([e.path])),
		);
	}

	unsubscribeEvents() {
		this._unsubscribeTokens.forEach((token) => DiskFileProvider.events.off(token));
	}

	pauseGitStaging() {
		this._stagingPaused = true;
		this._stagingBuffer = [];
	}

	async resumeGitStaging() {
		this._stagingPaused = false;
		const paths = this._stagingBuffer;
		if (paths.length > 0) await this._gitIndexAddFiles(paths);
		this._stagingBuffer = [];
	}

	private _deletedStatusAttrs(statuses: GitStatus[], filesToPublish?: Path[]) {
		const selected = filesToPublish?.length ? new Set(filesToPublish.map((path) => path.value)) : null;
		const deleted = statuses.filter(
			(status) => status.status === FileStatus.delete && (!selected || selected.has(status.path.value)),
		);

		return {
			"deleted.count": deleted.length,
			"deleted.paths": deleted.slice(0, 100).map((status) => status.path.value),
			"deleted.truncated": deleted.length > 100,
		};
	}

	private async _addDeletedStatusEvent(name: string, filesToPublish?: Path[]) {
		const activeSpan = span();
		if (!activeSpan) return;

		try {
			const statuses = await this.gvc.getChanges("index");
			activeSpan.addEvent(name, this._deletedStatusAttrs(statuses, filesToPublish));
		} catch (e) {
			activeSpan.addEvent(`${name}-failed`, { error: String(e) });
		}
	}

	checkoutIfCurrentBranchNotExist(): Promise<{ hasCheckout: boolean }> {
		return Promise.resolve({ hasCheckout: false });
	}

	async publish(data: PublishOptions): Promise<void> {
		const { data: sourceData, onPush, onlyPush, restoreIfFail } = data;

		if (onlyPush !== true) {
			const { commitMessage, filesToPublish, onAdd, onCommit } = data;
			onAdd?.();
			await this._addDeletedStatusEvent("git-status-before-publish-commit", filesToPublish);
			await this.gvc.commit(commitMessage, sourceData, null, filesToPublish);
			onCommit?.();
		}

		await this.storage.updateSyncCount();
		await this._push({ data: sourceData, onPush, restoreIfFail });
		await this._events.emit("publish", { repo: this });
		this.gvc.update();
	}

	async canSync(): Promise<boolean> {
		const toPush = (await this.storage.getSyncCount()).push;
		if (toPush > 0) return false;
		const status = await this.gvc.getChanges("index");
		return !status.length;
	}

	@trace({ level: Level.Full })
	async isShouldSync({ data, shouldFetch, onFetch }: IsShouldSyncOptions): Promise<boolean> {
		const toPull = (await this.storage.getSyncCount()).pull;
		if (toPull > 0) return true;

		if (shouldFetch) {
			await this.storage.fetch(data, false, false);
			onFetch?.();
		}

		const syncCount = await this.storage.getSyncCount();
		return syncCount.pull > 0;
	}

	@trace({ level: Level.Full })
	async status(cached = true): Promise<GitStatus[]> {
		if (cached) return this.gvc.getCachedStatus("workdir");
		return await this.gvc.getChanges("workdir");
	}

	@trace({ level: Level.Internal })
	async sync({ data, onPull, onPush }: SyncOptions): Promise<SyncResult> {
		let toPush = (await this.storage.getSyncCount()).push;
		if (toPush > 0) {
			// TODO:
			// handle commit merge too
		}

		const beforePullVersion = await this.gvc.getCurrentVersion();
		const { mergeFiles, mergeConflict } = await this._pull({ data, onPull, caller: MergeConflictCaller.Sync });

		this.gvc.update();
		const afterPullVersion = await this.gvc.getCurrentVersion();

		toPush = (await this.storage.getSyncCount()).push;

		if (toPush > 0 && !mergeConflict) {
			await this._push({ data, onPush });
			this.gvc.update();
		}

		const afterPushVersion = await this.gvc.getCurrentVersion();
		const isVersionChanged = !beforePullVersion.compare(afterPushVersion);

		await this._events.emit("sync", { repo: this, isVersionChanged });

		await this.gvc.checkChanges(beforePullVersion, afterPullVersion);

		return { mergeData: mergeFiles, isVersionChanged, before: beforePullVersion, after: afterPushVersion };
	}

	@trace({ level: Level.Internal })
	async checkout({ data, branch, onCheckout, onPull, force }: CheckoutOptions): Promise<GitMergeResultContent[]> {
		const oldVersion = await this.gvc.getCurrentVersion();
		const oldBranch = await this.gvc.getCurrentBranch();
		const allBranches = (await this.gvc.getAllBranches()).map((b) => b.getData().remoteName ?? b.getData().name);

		const state: RepositoryCheckoutState = { value: "checkout", data: { to: branch } };
		await this._state.saveState(state);

		const stashOid = await this.stash();

		let mergeFiles: GitMergeResultContent[] = [];

		try {
			if (!allBranches.includes(branch) && !data.isInvalid) await this.storage.fetch(data);
			await this.gvc.checkoutToBranch(data as GitSourceData, branch, force);
			onCheckout?.(branch);

			const isWeb = getExecutingEnvironment() === "web";
			if (!isWeb) await this.gvc.add();
			const changes = await this.gvc.getChanges("index");

			if (!data.isInvalid && !changes.length && !stashOid) {
				try {
					mergeFiles = (await this._pull({ data, onPull, stashOid, caller: MergeConflictCaller.Branch }))
						.mergeFiles;
				} catch (e) {
					await this.gvc.checkoutToBranch(data as GitSourceData, oldBranch.toString());
					await this._state.resetState();
					throw e;
				}
			} else if (stashOid) {
				// `oldVersion` is the head of the branch we just left, and aborting the conflict resets the
				// branch the repository is standing on to it. After a checkout that is a different branch, so
				// the name it belongs to has to travel with it — see `GitStashConflictResolver.abortMerge`.
				mergeFiles = await this._applyStashWithConflicts(stashOid, oldVersion, oldBranch.toString());
			}
		} catch (e) {
			// Between the stash and the apply the working copy is empty and the change is a commit in
			// `refs/stash` and nowhere else. Whatever went wrong here, that has to go back before the error
			// reaches the caller — otherwise the user is looking at a catalog their work has vanished from.
			await this._putBackAfterFailedCheckout(stashOid);
			throw e;
		}

		this.gvc.update();
		const newVersion = await this.gvc.getCurrentVersion();

		await this._events.emit("checkout", { repo: this, branch });
		await this.gvc.checkChanges(oldVersion, newVersion);

		const innerState = this._state.inner.value;
		if (innerState !== "stashConflict" && innerState !== "mergeConflict") await this._state.resetState();
		return mergeFiles;
	}

	async validateMerge(): Promise<void> {
		if ((await this.gvc.getChanges("workdir")).length > 0)
			throw new GitError(GitErrorCode.WorkingDirNotEmpty, null, { repositoryPath: this.gvc.getPath().value });
	}

	@trace({ level: Level.Internal })
	async merge({
		data,
		targetBranch,
		deleteAfterMerge,
		squash,
		validateMerge = true,
		isMergeRequest,
	}: MergeOptions): Promise<GitMergeResultContent[]> {
		if (validateMerge) await this.validateMerge();

		const branchNameBefore = (await this.gvc.getCurrentBranch()).toString();
		const beforeMergeCommit = await this.gvc.getHeadCommit(targetBranch);
		await this.checkout({ data, branch: targetBranch });

		const mergeResult = await this.gvc.mergeBranch(data as GitSourceData, {
			theirs: branchNameBefore,
			squash,
			isMergeRequest,
		});

		if (!mergeResult.length) {
			if (!data.isInvalid) await this.publish({ data, onlyPush: true, restoreIfFail: false });
			if (deleteAfterMerge) await this.deleteBranch(branchNameBefore, data);
			await this._events.emit("merge", { targetBranch, sourceData: data, beforeMergeCommit });
			return [];
		}

		const state: RepositoryMergeConflictState = {
			value: "mergeConflict",
			data: {
				branchNameBefore,
				theirs: branchNameBefore,
				conflictFiles: mergeResult,
				deleteAfterMerge,
				reverseMerge: true,
				squash,
				isMergeRequest,
			},
		};
		await this._state.saveState(state);

		return this._state.mergeConflictResolver.convertToMergeResultContent(mergeResult);
	}

	async getState(): Promise<RepositoryStateProvider> {
		const repState = this._state;
		await repState.getState();
		if (!this._getRepositoryStateFirstly) return repState;

		this._getRepositoryStateFirstly = false;

		// A conflict is a conversation already open with the user, and the stash it holds belongs to it.
		if (repState.inner.value === "mergeConflict" || repState.inner.value === "stashConflict") return repState;

		// Whatever the state file says about an operation in flight, the operation is over: this is the
		// first time the catalog is being opened. What it was doing is answered by `refs/stash`, which is
		// where the stash itself is — the state file only ever held a pointer to it, and never held one
		// at all when the interrupted operation was a checkout.
		if (repState.inner.value === "checkout" || repState.inner.value === "syncing") await this._state.resetState();

		await this._replayStashesLeftBehind();

		return this._state;
	}

	@trace({ level: Level.Internal })
	async deleteBranch(branchName: string, data: SourceData) {
		const branch = await this.gvc.getBranch(branchName);
		const branchRemoteName = branch.getData().remoteName;
		const isGit = isGitSourceType(await this.storage.getType());

		if (branchRemoteName && isGit)
			await (this.storage as GitStorage).deleteRemoteBranch(branchRemoteName, data as GitSourceData);

		await this.gvc.deleteLocalBranch(branchName);
	}

	/**
	 * The stash a failed checkout is holding, put back where the user can see it.
	 *
	 * Against the index rather than `HEAD`, because the checkout may have got as far as switching the
	 * branch: `HEAD` is then a different commit and the working copy is what the index says. A
	 * conflict is left standing as one — the interface it goes to is the same one a sync conflict
	 * uses. If even that fails the stash stays in `refs/stash`, and opening the catalog again replays
	 * it; the error on its way out is the user's answer for now.
	 */
	private async _putBackAfterFailedCheckout(stashOid: GitStash | null): Promise<void> {
		if (!stashOid) {
			await this._state.resetState();
			return;
		}

		try {
			const branchNameBefore = (await this.gvc.getCurrentBranch()).toString();
			const commitHeadBefore = await this.gvc.getCurrentVersion();
			const conflicts = await this.gvc.applyStash(stashOid, { deleteAfterApply: false, againstIndex: true });

			if (conflicts.length) {
				await this._applyStashConflictState(stashOid, conflicts, commitHeadBefore, branchNameBefore);
				return;
			}

			await this.gvc.deleteStash(stashOid);
			await this._state.resetState();
		} catch (error) {
			span()?.addEvent("stash-put-back-failed", { stash: stashOid.toString(), error: String(error) });
			await this._state.resetState();
		}
	}

	/**
	 * Puts back what an interrupted operation stashed and never got to apply.
	 *
	 * Runs when a catalog is opened, and reads `refs/stash` rather than the state file. Between taking
	 * a stash and writing down that it took one, an operation can die — and a checkout never wrote it
	 * down at all. The stash commit is on disk the moment the working copy is emptied, so it is the
	 * only record that is always there. `gc` does not collect it: a ref points at it.
	 *
	 * Replayed against the index, not `HEAD`: by now the user may have been editing, and those edits
	 * are in the index. A conflict is handed to the same interface a sync conflict goes to.
	 *
	 * What the user has written since goes aside first, into a stash of its own. Everything then lands
	 * on a working copy that matches `HEAD`, and a conflict can be abandoned the way every other stash
	 * conflict is — `reset --hard` and replay — without that reset taking their work with it.
	 *
	 * Nothing is deleted before all of it has landed: a stash whose content is on disk only because a
	 * later one has not been settled yet is still the only copy of it.
	 *
	 * Stashes a person made themselves, with `git stash` in a terminal, are theirs to replay.
	 */
	private async _replayStashesLeftBehind(): Promise<void> {
		const pending = await this._stashesLeftBehind();
		if (!pending.length) return;

		span()?.addEvent("stash-left-behind", { count: pending.length });

		const branchNameBefore = (await this.gvc.getCurrentBranch()).toString();
		const commitHeadBefore = await this.gvc.getCurrentVersion();

		// Oldest first, so what was put aside later lands on top of what was put aside earlier; the
		// user's own work, put aside just now, is the last of them and lands on top of everything.
		const replaying = [...pending].reverse().map(({ oid }) => new GitStash(oid));

		let ownWork: GitStash | null = null;

		try {
			ownWork = await this.stash();
			if (ownWork) replaying.push(ownWork);
		} catch (error) {
			// Nothing has been touched yet, so there is nothing to undo — and putting stashes back over
			// work that could not be set aside is exactly what this is here to avoid.
			span()?.addEvent("stash-own-work-failed", { error: String(error) });
			return;
		}

		for (const stash of replaying) {
			try {
				const conflicts = await this.gvc.applyStash(stash, { deleteAfterApply: false, againstIndex: true });

				if (conflicts.length) {
					await this._applyStashConflictState(stash, conflicts, commitHeadBefore, branchNameBefore);
					return;
				}
			} catch (error) {
				// Opening a catalog cannot be the thing that fails, and no stash has been deleted, so the
				// next open tries again. But the working copy was emptied to put the user's own work aside,
				// and leaving it that way is the disappearance this whole method exists to prevent: they
				// would open the catalog and find their text gone, with the only copy in a reflog no
				// interface shows.
				span()?.addEvent("stash-replay-failed", { stash: stash.toString(), error: String(error) });
				await this._putOwnWorkBack(ownWork);
				return;
			}
		}

		for (const stash of replaying) await this.gvc.deleteStash(stash);
		this._state.stashRestored = true;
	}

	/**
	 * Returns the user's own work to the working copy after a replay that could not go on.
	 *
	 * It was put aside a moment ago so that the replay would land on a clean copy; if the replay is
	 * not happening, there is no reason for it to be aside. Failing here leaves it in `refs/stash`
	 * with everything else, which is where the next open looks.
	 */
	private async _putOwnWorkBack(ownWork: GitStash | null): Promise<void> {
		if (!ownWork) return;

		try {
			const conflicts = await this.gvc.applyStash(ownWork, { deleteAfterApply: false, againstIndex: true });

			if (conflicts.length) {
				// An earlier stash landed before the one that failed, so the working copy is no longer what
				// this was taken from and the two disagree. That is a conflict, and it goes where every
				// other stash conflict goes — leaving it unsaid would show the user a catalog holding
				// somebody else's text and none of their own.
				await this._applyStashConflictState(
					ownWork,
					conflicts,
					await this.gvc.getCurrentVersion(),
					(await this.gvc.getCurrentBranch()).toString(),
				);
				return;
			}

			await this.gvc.deleteStash(ownWork);
		} catch (error) {
			span()?.addEvent("stash-own-work-not-returned", { error: String(error), stash: ownWork.toString() });
		}
	}

	/**
	 * The stashes Gramax left behind here, or nothing at all when the question cannot be asked.
	 *
	 * Opening a catalog reaches this before anything has established that the folder is a repository
	 * this process can read, and a folder that is not one has no stash to put back either way.
	 */
	private async _stashesLeftBehind(): Promise<StashInfo[]> {
		try {
			return (await this.gvc.listStashes()).filter((stash) => !stash.isForeign);
		} catch (error) {
			span()?.addEvent("stash-list-failed", { error: String(error) });
			return [];
		}
	}

	private async _applyStashConflictState(
		stashOid: GitStash,
		conflicts: GitMergeResult[],
		commitHeadBefore: GitVersion,
		branchNameBefore: string,
	): Promise<void> {
		const state: RepositoryStashConflictState = {
			value: "stashConflict",
			data: {
				branchNameBefore,
				commitHeadBefore: commitHeadBefore.toString(),
				conflictFiles: conflicts,
				reverseMerge: true,
				stashHash: stashOid.toString(),
			},
		};

		await this._state.saveState(state);
	}

	/** Waits for every write seen so far to have reached the index. */
	async flushGitStaging(): Promise<void> {
		if (this._stagingPaused) await this.resumeGitStaging();
		await this._staging;
	}

	async attributes(rootPath: Path = this._repoPath): Promise<GitAttributes> {
		return await GitAttributes.parse(this._fp, rootPath, async (attributesPath) => {
			const relative = this._repoPath.subDirectory(attributesPath);
			await this._gvc.add([relative ?? attributesPath]);
		});
	}

	private _gitIndexAddFiles(p: Path[]): Promise<void> {
		// Chained rather than awaited by the caller: the events cannot be awaited, but they can be kept
		// in order, and `flushGitStaging` waits for the tail. The tail swallows the failure so one bad
		// path cannot stop everything staged after it; the caller still gets it.
		const staged = this._staging.then(() => this._stagePaths(p));
		this._staging = staged.catch(() => undefined);
		return staged;
	}

	private async _stagePaths(p: Path[]) {
		const paths = p.filter(
			(x) =>
				x?.value?.length &&
				x?.rootDirectory?.value === this._repoPath.rootDirectory.value &&
				x.value !== this._repoPath.value &&
				x.value !== this._repoPath.join(new Path(".git")).value,
		);

		if (paths.length === 0) return;

		span()?.addEvent("git-index-add-files", {
			"paths.count": paths.length,
			paths: paths.slice(0, 100).map((path) => path.value),
			truncated: paths.length > 100,
		});

		if (this._stagingPaused) {
			this._stagingBuffer.push(...paths);
			return;
		}

		const gitPaths = paths.map((x) => this._repoPath.rootDirectory.subDirectory(x));

		try {
			await this.gvc.add(gitPaths);
		} catch (e) {
			console.error(e);
		}
	}

	@trace({ level: Level.Internal })
	private async _push({
		data,
		onPush,
		restoreIfFail = true,
	}: {
		data: SourceData;
		onPush?: () => void | Promise<void>;
		restoreIfFail?: boolean;
	}): Promise<void> {
		try {
			await this.storage.push(data);
		} catch (e) {
			if (restoreIfFail && !(await this._hasIndexConflicts())) await this.gvc.restoreRepositoryState();
			await this.storage.updateSyncCount();
			throw e;
		}
		await onPush?.();
	}

	private async _hasIndexConflicts(): Promise<boolean> {
		try {
			return (await this.gvc.getChanges("index")).some((status) => status.status === FileStatus.conflict);
		} catch (error) {
			span()?.addEvent("index-conflicts-check-failed", { error: String(error) });
			return false;
		}
	}

	private async _applyStashWithConflicts(
		stashOid: GitStash,
		commitHeadBefore: GitVersion,
		branchNameBefore?: string,
	): Promise<GitMergeResultContent[]> {
		let stashResult: GitMergeResult[];

		try {
			stashResult = await this.gvc.applyStash(stashOid, { deleteAfterApply: false });
		} catch (error) {
			// Something is standing at the paths the stash has to write, so replaying it against `HEAD` is
			// refused. The ordinary way that happens: the user kept typing while the branch was switching,
			// and every keystroke reached the index. Merged against the index instead, their text is a side
			// of the merge — so what cannot be reconciled comes back as a conflict they resolve, and both
			// texts are in the file.
			span()?.addEvent("stash-apply-against-index", { stash: stashOid.toString(), error: String(error) });
			stashResult = await this.gvc.applyStash(stashOid, { deleteAfterApply: false, againstIndex: true });
		}

		if (!stashResult.length) {
			await this.gvc.deleteStash(stashOid);
			return [];
		}

		const state: RepositoryStashConflictState = {
			value: "stashConflict",
			data: {
				branchNameBefore,
				commitHeadBefore: commitHeadBefore.toString(),
				conflictFiles: stashResult,
				reverseMerge: true,
				stashHash: stashOid.toString(),
			},
		};
		await this._state.saveState(state);

		return this._state.stashConflictResolver.convertToMergeResultContent(stashResult);
	}

	@trace({ level: Level.Internal })
	private async _pull({
		data,
		onPull,
		stashOid: existingStash,
		caller,
	}: {
		data: SourceData;
		onPull?: () => void;
		stashOid?: GitStash;
		caller: MergeConflictCaller;
	}): Promise<PullResult> {
		let stashResult: GitMergeResult[] = [];
		const commitHeadBefore = await this.gvc.getCurrentVersion();

		const stashOid = existingStash ?? (await this.stash());
		await this._addDeletedStatusEvent("git-status-before-pull");

		if (stashOid) {
			const syncingState: RepositorySyncingState = {
				value: "syncing",
				data: {
					stashHash: stashOid.toString(),
					commitHeadBefore: commitHeadBefore.toString(),
				},
			};
			await this._state.saveState(syncingState);
		}

		let pullConflicts: GitMergeResult[] = [];

		try {
			pullConflicts = await this.storage.pull(data);
		} catch (e) {
			// The hard reset is here to undo a merge that got halfway, and it only makes sense if the
			// merge got anywhere at all. When it refused before touching anything — the checkout is safe,
			// so a file it cannot update stops it up front — HEAD is still where it was, and resetting
			// would throw away the working copy over a pull that never happened. That is a change the
			// stash may not hold: it carries what the index knew, and the refusal usually means the disk
			// held something the index did not.
			const headAfter = await this.gvc.getCurrentVersion();
			if (headAfter.toString() !== commitHeadBefore.toString())
				await this.gvc.reset({ mode: "hard", head: commitHeadBefore });

			if (stashOid) await this.gvc.applyStash(stashOid);
			await this._state.resetState();
			throw e;
		}

		if (pullConflicts.length) return await this._applyPullMergeConflictState(pullConflicts, stashOid, caller);

		await this._addDeletedStatusEvent("git-status-after-pull-before-stash-apply");
		if (stashOid) stashResult = await this.gvc.applyStash(stashOid, { deleteAfterApply: false });
		await this._addDeletedStatusEvent("git-status-after-stash-apply");

		onPull?.();

		if (!stashResult.length) {
			if (stashOid) await this.gvc.deleteStash(stashOid);
			await this._state.resetState();
			return { mergeFiles: [], mergeConflict: false };
		}

		const state: RepositoryStashConflictState = {
			value: "stashConflict",
			data: {
				commitHeadBefore: commitHeadBefore.toString(),
				conflictFiles: stashResult,
				reverseMerge: true,
				stashHash: stashOid.toString(),
			},
		};

		await this._state.saveState(state);

		return {
			mergeFiles: await this._state.stashConflictResolver.convertToMergeResultContent(stashResult),
			mergeConflict: false,
		};
	}

	private async _applyPullMergeConflictState(
		conflicts: GitMergeResult[],
		stashOid: GitStash | null,
		caller: MergeConflictCaller,
	): Promise<PullResult> {
		const state: RepositoryMergeConflictState = {
			value: "mergeConflict",
			data: {
				theirs: await this.gvc.getUpstreamRef(),
				conflictFiles: conflicts,
				reverseMerge: false,
				deleteAfterMerge: false,
				squash: false,
				caller,
				stashHash: stashOid?.toString(),
			},
		};

		await this._state.saveState(state);

		return {
			mergeFiles: await this._state.mergeConflictResolver.convertToMergeResultContent(conflicts),
			mergeConflict: true,
		};
	}
}
