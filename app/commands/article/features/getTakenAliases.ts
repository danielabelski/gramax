import { ResponseKind } from "@app/types/ResponseKind";
import { AuthorizeMiddleware } from "@core/Api/middleware/AuthorizeMiddleware";
import { DesktopModeMiddleware } from "@core/Api/middleware/DesktopModeMiddleware";
import type Context from "@core/Context/Context";
import Path from "@core/FileProvider/Path/Path";
import { aliasPathOf } from "@core/FileStructue/Alias/AliasIndex";
import { Command } from "../../../types/Command";

const getTakenAliases: Command<{ ctx: Context; path: Path; catalogName: string }, string[]> = Command.create({
	path: "article/features/getTakenAliases",

	kind: ResponseKind.json,

	middlewares: [new AuthorizeMiddleware(), new DesktopModeMiddleware()],

	async do({ ctx, catalogName, path }) {
		const workspace = this._app.wm.current();
		const catalog = await workspace.getCatalog(catalogName, ctx);
		const fp = workspace.getFileProvider();
		const itemRef = fp.getItemRef(path);
		const currentItem = catalog.findItemByItemRef(itemRef);
		// a translation shows the aliases of its main-language twin, so they are not taken for it either
		const aliasOwner = currentItem ? catalog.deref.aliases.ownerOf(currentItem) : null;

		const taken = new Set<string>();
		if (currentItem) taken.add(catalog.deref.relativeLogicPath(currentItem.logicPath));
		for (const item of catalog.getItems()) {
			if (item === currentItem) continue;
			taken.add(catalog.deref.relativeLogicPath(item.logicPath));
			if (item === aliasOwner || !Array.isArray(item.props.aliases)) continue;
			for (const entry of item.props.aliases) {
				const aliasPath = aliasPathOf(entry);
				if (aliasPath) taken.add(aliasPath);
			}
		}
		return [...taken];
	},

	params(ctx, q) {
		const path = new Path(q.path);
		const catalogName = q.catalogName;
		return { ctx, path, catalogName };
	},
});

export default getTakenAliases;
