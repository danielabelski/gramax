import { Command } from "@app/types/Command";
import { ResponseKind } from "@app/types/ResponseKind";
import { AuthorizeMiddleware } from "@core/Api/middleware/AuthorizeMiddleware";
import type { GitRevisionsFilter } from "@ext/git/actions/Revisions/model/GitRevisionsFilter";
import type { GitVersionDataSet } from "@ext/git/core/GitVersionControl/GitVersionControl";
import { GitVersion } from "@ext/git/core/model/GitVersion";

const emptyRevisions: GitVersionDataSet = { data: [], reachedFirstCommit: true };

const getRevisions: Command<
	{ catalogName: string; from?: string; depth?: number; filters: GitRevisionsFilter },
	GitVersionDataSet
> = Command.create({
	path: "versionControl/revision/getRevisions",

	kind: ResponseKind.json,

	middlewares: [new AuthorizeMiddleware()],

	async do({ catalogName, from, depth, filters }) {
		const { wm } = this._app;
		const workspace = wm.current();

		// catalogName can arrive null when the caller (e.g. a still-mounted revisions panel) fires
		// this after navigating to a page whose catalog no longer resolves — return empty instead
		// of asserting, matching `versionControl/diff/getDiffTree`'s convention for the same case.
		const catalog = await workspace.getContextlessCatalog(catalogName);
		if (!catalog?.repo?.gvc) return emptyRevisions;

		return await catalog.repo.gvc.getCommitInfo(from ? new GitVersion(from) : undefined, depth, filters);
	},

	params(ctx, q, body) {
		return {
			ctx,
			catalogName: q.catalogName,
			from: q.from,
			depth: q.depth ? Number(q.depth) : undefined,
			filters: body as GitRevisionsFilter,
		};
	},
});

export default getRevisions;
