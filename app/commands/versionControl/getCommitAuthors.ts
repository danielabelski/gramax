import { ResponseKind } from "@app/types/ResponseKind";
import { AuthorizeMiddleware } from "@core/Api/middleware/AuthorizeMiddleware";
import type { CommitAuthorInfo } from "@ext/git/core/GitCommands/LibGit2IntermediateCommands";
import { Command } from "../../types/Command";

const getCommitAuthors: Command<
	{ catalogName: string; authorFilter?: string; pathspecs?: string[] },
	CommitAuthorInfo[]
> = Command.create({
	path: "versionControl/getCommitAuthors",

	kind: ResponseKind.json,

	middlewares: [new AuthorizeMiddleware()],

	async do({ catalogName, authorFilter, pathspecs }) {
		const workspace = this._app.wm.current();
		const catalog = await workspace.getContextlessCatalog(catalogName);
		const vc = catalog?.repo?.gvc;
		if (!vc) return;

		const authors = await vc.getCommitAuthors(pathspecs);
		if (authorFilter) return authors.filter((author) => author.name.includes(authorFilter));
		return authors;
	},

	params(ctx, q, body) {
		return {
			ctx,
			catalogName: q.catalogName,
			authorFilter: q.authorFilter,
			pathspecs: (body as { pathspecs?: string[] })?.pathspecs,
		};
	},
});

export default getCommitAuthors;
