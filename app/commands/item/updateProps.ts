import { ResponseKind } from "@app/types/ResponseKind";
import { AuthorizeMiddleware } from "@core/Api/middleware/AuthorizeMiddleware";
import { DesktopModeMiddleware } from "@core/Api/middleware/DesktopModeMiddleware";
import ReloadConfirmMiddleware from "@core/Api/middleware/ReloadConfirmMiddleware";
import type Context from "@core/Context/Context";
import Path from "@core/FileProvider/Path/Path";
import LastVisited from "@core/SitePresenter/LastVisited";
import type { ClientArticleProps, ClientItemRef } from "@core/SitePresenter/SitePresenter";
import { Command } from "../../types/Command";

export type UpdateItemPropsResult = {
	pathname: string;
	ref: ClientItemRef;
	fileName: string;
	logicPath: string;
};

const updateProps: Command<{ ctx: Context; catalogName: string; props: ClientArticleProps }, UpdateItemPropsResult> =
	Command.create({
		path: "item/updateProps",

		kind: ResponseKind.json,

		middlewares: [new AuthorizeMiddleware(), new DesktopModeMiddleware(), new ReloadConfirmMiddleware()],

		async do({ ctx, catalogName, props }) {
			const { wm, resourceUpdaterFactory } = this._app;
			const workspace = wm.current();

			const catalog = await workspace.getCatalog(catalogName, ctx);
			if (!catalog) return;

			// Resolved by file path: the only identifier the client gets back from this very response
			// and keeps current. The `logicPath` it sends is one step behind after a rename, and
			// looking up by it silently found nothing — the edit was lost. What goes on is the item
			// itself: the catalog has no business finding it a second time, by another field.
			const item = catalog.findItemByItemPath(new Path(props.ref.path));
			if (!item) return;

			const pathnameBefore = await catalog.getPathname(item);
			const updatedItem = await catalog.updateItemProps(item, props, resourceUpdaterFactory);
			if (!updatedItem) return;

			const pathname = await catalog.getPathname(updatedItem);
			// Otherwise recorded by a page read, and none follows a rename.
			new LastVisited(ctx, (await workspace.config()).name).move(catalog, pathnameBefore, pathname);

			const ref = { path: updatedItem.ref.path.value, storageId: updatedItem.ref.storageId };
			// The file name was a guess: the server takes another one when that is occupied. Returning
			// the actual one — with the rest of the address — is the only way the client learns it: the
			// page is not re-read after a rename, so anything left from the old path would stay forever.
			return {
				pathname,
				ref,
				fileName: updatedItem.getFileName(),
				logicPath: updatedItem.logicPath,
			};
		},

		params(ctx, q, body) {
			const catalogName = q.catalogName;
			const props = body;
			return { ctx, catalogName, props };
		},
	});

export default updateProps;
