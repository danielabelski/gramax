/* eslint-disable @typescript-eslint/no-unused-vars */

import type GitSourceData from "@ext/git/core/model/GitSourceData.schema";
import GitStash from "@ext/git/core/model/GitStash";
import { GitVersion } from "@ext/git/core/model/GitVersion";
import type Repository from "@ext/git/core/Repository/Repository";
import type { RepositoryStashConflictState } from "@ext/git/core/Repository/state/RepositoryState";
import type SourceData from "@ext/storage/logic/SourceDataProvider/model/SourceData";
import type FileProvider from "../../../../../logic/FileProvider/model/FileProvider";
import type Path from "../../../../../logic/FileProvider/Path/Path";
import GitBaseConflictResolver from "../Base/GitBaseConflictResolver";

export default class GitStashConflictResolver extends GitBaseConflictResolver {
	constructor(
		protected _repo: Repository,
		fp: FileProvider,
		pathToRep: Path,
	) {
		super(_repo, fp, pathToRep);
	}

	async abortMerge(state: RepositoryStashConflictState, data: SourceData): Promise<void> {
		await super.abortMerge(state);

		// `commitHeadBefore` is a commit on `branchNameBefore`, and `reset --hard` moves whichever branch
		// is checked out. When a checkout raised the conflict that is no longer the same branch, and
		// resetting here would point the branch just checked out at another branch's commit — everything
		// committed on it is then gone from the working copy. Go back first; the reset then undoes the
		// checkout the way the user asked for.
		const branchNameBefore = state.data.branchNameBefore;
		if (branchNameBefore && branchNameBefore !== (await this._repo.gvc.getCurrentBranchName(false)))
			await this._repo.gvc.checkoutToBranch(data as GitSourceData, branchNameBefore, true);

		const commitHeadBefore = state.data.commitHeadBefore;
		if (commitHeadBefore) await this._repo.gvc.reset({ mode: "hard", head: new GitVersion(commitHeadBefore) });
		const stashHash = new GitStash(state.data.stashHash);
		await this._repo.gvc.applyStash(stashHash);
	}

	async resolveConflictedFiles(
		files: { path: string; content: string }[],
		state: RepositoryStashConflictState,
		_data: SourceData,
	): Promise<void> {
		await super.resolveConflictedFiles(files, state);

		// to remove conflicted files in status
		await this._repo.gvc.add(null, true);
		await this._repo.gvc.deleteStash(new GitStash(state.data.stashHash));
	}
}
