import { getExecutingEnvironment } from "@app/resolveModule/env";
import { ResponseKind } from "@app/types/ResponseKind";
import { DesktopModeMiddleware } from "@core/Api/middleware/DesktopModeMiddleware";
import type Context from "@core/Context/Context";
import { GitVersion } from "@ext/git/core/model/GitVersion";
import BrokenRepository from "@ext/git/core/Repository/BrokenRepository";
import type { FileStatus } from "@ext/Watchers/model/FileStatus";
import { Command } from "../../types/Command";

/** Git's well-known empty tree — the stand-in "before" state of a root commit. */
const EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export type ClientGitStatus = {
	path: string;
	status: FileStatus;
};

const status: Command<{ ctx: Context; catalogName: string; commitOid?: string }, ClientGitStatus[]> = Command.create({
	path: "versionControl/statuses",

	kind: ResponseKind.json,

	middlewares: [new DesktopModeMiddleware()],

	async do({ catalogName, commitOid }) {
		const workspace = this._app.wm.current();
		const catalog = await workspace.getContextlessCatalog(catalogName);

		if (!catalog?.repo || catalog.repo instanceof BrokenRepository || catalog.repo.gvc === null) return [];

		if (commitOid) {
			const parentCommit = await catalog.repo.gvc.getParentCommitHash(new GitVersion(commitOid));
			const parentCommitOid = parentCommit?.toString();

			const diff = await catalog.repo.gvc.diff({
				// A root commit has no parent, and `getParentCommitHash` reports that as
				// `GitVersion(null)`; passing `old: null` down to the diff rustCall makes serde
				// reject it ("invalid type: null, expected a string"). The empty tree stands in for
				// the missing parent, so every file the root commit introduced reads as added.
				compare: { type: "tree", new: commitOid, old: parentCommitOid ?? EMPTY_TREE_OID },
				renames: true,
				// The empty tree is not a commit, so it has no merge base with `commitOid`:
				// looking one up would fail instead of producing the diff.
				useMergeBase: !!parentCommitOid,
			});
			return diff.files.map((file) => ({
				path: catalog.basePath.join(file.path).value,
				status: file.status,
			}));
		}

		if (getExecutingEnvironment() !== "web") await catalog.repo.gvc.add();

		const changes = await catalog.repo.gvc.getChanges("index");

		return changes.map((change) => ({
			path: catalog.basePath.join(change.path).value,
			status: change.status,
		}));
	},

	params(ctx, q) {
		return { ctx, catalogName: q.catalogName, commitOid: q.commitOid };
	},
});

export default status;
