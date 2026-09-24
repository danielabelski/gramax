import { ResponseKind } from "@app/types/ResponseKind";
import { AuthorizeMiddleware } from "@core/Api/middleware/AuthorizeMiddleware";
import type { CommitRangeInfo } from "@ext/git/core/GitCommands/LibGit2IntermediateCommands";
import { Command } from "../../types/Command";

const getCommitRange: Command<{ catalogName: string; pathspecs?: string[] }, CommitRangeInfo> = Command.create({
	path: "versionControl/getCommitRange",

	kind: ResponseKind.json,

	middlewares: [new AuthorizeMiddleware()],

	async do({ catalogName, pathspecs }) {
		const workspace = this._app.wm.current();
		const catalog = await workspace.getContextlessCatalog(catalogName);
		const vc = catalog?.repo?.gvc;
		if (!vc) return;

		return await vc.getCommitRange(pathspecs);
	},

	params(ctx, q, body) {
		return { ctx, catalogName: q.catalogName, pathspecs: (body as { pathspecs?: string[] })?.pathspecs };
	},
});

export default getCommitRange;
