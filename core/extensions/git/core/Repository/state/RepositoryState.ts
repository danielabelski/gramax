import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import type FileStructure from "@core/FileStructue/FileStructure";
import type GitMergeResult from "@ext/git/actions/MergeConflictHandler/model/GitMergeResult";
import type { GitMergeResultContent } from "@ext/git/actions/MergeConflictHandler/model/GitMergeResultContent";
import type MergeConflictCaller from "@ext/git/actions/MergeConflictHandler/model/MergeConflictCaller";
import GitMergeConflictResolver from "@ext/git/core/GitMergeConflictResolver/Merge/GitMergeConflictResolver";
import GitStashConflictResolver from "@ext/git/core/GitMergeConflictResolver/Stash/GitStashConflictResolver";
import GitStash from "@ext/git/core/model/GitStash";
import type Repository from "@ext/git/core/Repository/Repository";
import type SourceData from "@ext/storage/logic/SourceDataProvider/model/SourceData";

type State<K extends string, V extends object> = {
	value: K;
	data?: V;
};

export type RepositoryDefaultState = State<"default", null>;

export type RepositoryMergeConflictState = State<
	"mergeConflict",
	{
		deleteAfterMerge: boolean;
		squash: boolean;
		theirs: string;
		conflictFiles: GitMergeResult[];
		reverseMerge: boolean;
		branchNameBefore?: string;
		isMergeRequest?: boolean;
		caller?: MergeConflictCaller;
		stashHash?: string;
	}
>;

export type RepositoryStashConflictState = State<
	"stashConflict",
	{
		stashHash: string;
		reverseMerge: true;
		conflictFiles: GitMergeResult[];
		commitHeadBefore: string;
		/**
		 * The branch `commitHeadBefore` belongs to, set only when a checkout raised the conflict.
		 *
		 * Aborting resets the branch the repository stands on. A sync raises the conflict on the branch
		 * it started from, so there is nothing to remember; a checkout leaves the repository on another
		 * branch entirely, and the abort has to come back before it resets anything.
		 */
		branchNameBefore?: string;
	}
>;

export type RepositoryCheckoutState = State<
	"checkout",
	{
		to: string;
	}
>;

export type RepositorySyncingState = State<
	"syncing",
	{
		stashHash: string;
		commitHeadBefore: string;
	}
>;

export type RepositoryState =
	| RepositoryDefaultState
	| RepositoryMergeConflictState
	| RepositoryStashConflictState
	| RepositoryCheckoutState
	| RepositorySyncingState;

const REPOSITORY_STATE_FILEPATH = ".git/gramax/state.json";

export default class RepositoryStateProvider {
	private _inner: RepositoryState;
	private _mergeConflictResolver: GitMergeConflictResolver;
	private _stashConflictResolver: GitStashConflictResolver;
	private _stashRestored: boolean;

	constructor(
		private _repo: Repository,
		private _repoPath: Path,
		private _fp: FileProvider,
	) {
		this._mergeConflictResolver = new GitMergeConflictResolver(this._repo, this._fp, this._repoPath);
		this._stashConflictResolver = new GitStashConflictResolver(this._repo, this._fp, this._repoPath);
	}

	get inner() {
		return this._inner || { value: "default" };
	}

	get stashRestored() {
		return this._stashRestored;
	}

	set stashRestored(value: boolean) {
		this._stashRestored = value;
	}

	get mergeConflictResolver() {
		return this._mergeConflictResolver;
	}

	get stashConflictResolver() {
		return this._stashConflictResolver;
	}

	async resolveMerge(files: { path: string; content: string }[], data: SourceData) {
		const state = await this.getState();
		if (state.value !== "mergeConflict" && state.value !== "stashConflict") return;
		if (state.value === "mergeConflict") {
			await this._mergeConflictResolver.resolveConflictedFiles(files, state, data);
			if (state.data.deleteAfterMerge) await this._repo.deleteBranch(state.data.theirs, data);
		} else if (state.value === "stashConflict")
			await this._stashConflictResolver.resolveConflictedFiles(files, state, data);
		await this._finishMergeState(state);
	}

	async abortMerge(data: SourceData) {
		const state = await this.getState();

		if (state.value !== "mergeConflict" && state.value !== "stashConflict") return;
		if (state.value === "mergeConflict") await this._mergeConflictResolver.abortMerge(state, data);
		else if (state.value === "stashConflict") await this._stashConflictResolver.abortMerge(state, data);

		await this._finishMergeState(state);
	}

	private async _finishMergeState(state: RepositoryMergeConflictState | RepositoryStashConflictState) {
		if (state.value !== "mergeConflict" || !state.data.stashHash) {
			await this.resetState();
			return;
		}

		const stash = new GitStash(state.data.stashHash);
		const commitHeadBefore = await this._repo.gvc.getCurrentVersion();
		let conflicts: GitMergeResult[];
		try {
			conflicts = await this._repo.gvc.applyStash(stash, { deleteAfterApply: false });
		} catch {
			await this.resetState();
			return;
		}

		if (!conflicts.length) {
			await this._repo.gvc.deleteStash(stash);
			await this.resetState();
			return;
		}

		await this.saveState({
			value: "stashConflict",
			data: {
				stashHash: stash.toString(),
				commitHeadBefore: commitHeadBefore.toString(),
				conflictFiles: conflicts,
				reverseMerge: true,
			},
		});
	}

	async isMergeStateValid(): Promise<boolean> {
		const state = await this.getState();
		if (state.value === "mergeConflict" || state.value === "stashConflict") {
			const isValid = await this._mergeConflictResolver.isMergeStateValidate(state.data.conflictFiles);
			if (!isValid) await this._finishMergeState(state);
			return isValid;
		}
	}

	async convertToMergeResultContent(
		mergeResult: GitMergeResult[],
		fs?: FileStructure,
	): Promise<GitMergeResultContent[]> {
		return this._mergeConflictResolver.convertToMergeResultContent(mergeResult, fs);
	}

	async abortCheckoutState() {
		if (this._inner.value !== "checkout") return;
		await this.resetState();
	}

	async getState(): Promise<RepositoryState> {
		if (!this._inner) await this._read();
		return this._inner;
	}

	resetState(): Promise<void> {
		return this.saveState({ value: "default" });
	}

	async saveState(state: RepositoryState): Promise<void> {
		this._inner = state;
		await this._write();
	}

	private async _write(): Promise<void> {
		const path = this._path();
		if (!(await this._fp.exists(path.parentDirectoryPath))) await this._fp.mkdir(path.parentDirectoryPath);
		return this._fp.write(path, JSON.stringify(this._inner));
	}

	private async _read() {
		if (await this._fp.exists(this._path())) {
			this._inner = JSON.parse(await this._fp.read(this._path()));
			return;
		}
		this._inner = { value: "default" };
		await this._write();
	}

	private _path(): Path {
		return this._repoPath.join(new Path([REPOSITORY_STATE_FILEPATH]));
	}
}
