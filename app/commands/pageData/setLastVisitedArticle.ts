import { Command } from "@app/types/Command";
import { ResponseKind } from "@app/types/ResponseKind";
import type Context from "@core/Context/Context";
import LastVisited from "@core/SitePresenter/LastVisited";

const setLastVisitedArticle: Command<{ ctx: Context; catalogName: string; pathname: string }, void> = Command.create({
	path: "page/setLastVisitedArticle",

	kind: ResponseKind.none,

	async do({ ctx, catalogName, pathname }) {
		const workspace = this._app.wm.current();
		const catalog = await workspace.getContextlessCatalog(catalogName);
		if (!catalog) return;

		new LastVisited(ctx, (await workspace.config()).name).setLastVisitedArticle(catalog, pathname);
	},

	// The address travels in the body: the web fetcher decodes every query value once more, and a
	// catalog behind a repository spells its group with an encoded slash.
	params(ctx, q, body: { pathname: string }) {
		return { ctx, catalogName: q.catalogName, pathname: body.pathname };
	},
});

export default setLastVisitedArticle;
