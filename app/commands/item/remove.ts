import { CATEGORY_ROOT_FILENAME } from "@app/config/const";
import { ResponseKind } from "@app/types/ResponseKind";
import { AuthorizeMiddleware } from "@core/Api/middleware/AuthorizeMiddleware";
import { DesktopModeMiddleware } from "@core/Api/middleware/DesktopModeMiddleware";
import ReloadConfirmMiddleware from "@core/Api/middleware/ReloadConfirmMiddleware";
import type Context from "@core/Context/Context";
import Path from "@core/FileProvider/Path/Path";
import ArticleParser from "@core/FileStructue/Article/ArticleParser";
import getPrevSiblingPathname from "@core/utils/getPrevSiblingPathname";
import { Command } from "../../types/Command";

const remove: Command<{ ctx: Context; catalogName: string; path: Path; currentArticlePath: Path }, string> =
	Command.create({
		path: "item/remove",

		kind: ResponseKind.plain,

		middlewares: [new AuthorizeMiddleware(), new DesktopModeMiddleware(), new ReloadConfirmMiddleware()],

		async do({ ctx, catalogName, path, currentArticlePath }) {
			const { wm, parser, parserContextFactory } = this._app;
			const workspace = wm.current();

			const catalog = await workspace.getCatalog(catalogName, ctx);
			const fp = workspace.getFileProvider();
			const articleParser = new ArticleParser(ctx, parser, parserContextFactory);

			const removedDir =
				path.nameWithExtension === CATEGORY_ROOT_FILENAME ? path.parentDirectoryPath.value : path.value;
			const isCurrentArticleAffected =
				path.compare(currentArticlePath) ||
				(removedDir && currentArticlePath.value.startsWith(`${removedDir}/`));

			const redirectPath = isCurrentArticleAffected
				? await getPrevSiblingPathname(catalog, path)
				: await catalog.getPathname(catalog.findItemByItemPath(currentArticlePath));

			await catalog.deleteItem(fp.getItemRef(path), articleParser);
			return redirectPath;
		},

		params(ctx, q) {
			const catalogName = q.catalogName;
			const path = new Path(q.articlePath);
			const currentArticlePath = new Path(q.currentArticlePath);
			return { ctx, catalogName, path, currentArticlePath };
		},
	});

export default remove;
