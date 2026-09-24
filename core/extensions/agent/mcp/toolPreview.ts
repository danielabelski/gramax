import type Application from "@app/types/Application";
import type Context from "@core/Context/Context";
import { CatalogItemLookup } from "./utils/catalogPaths";

export type ToolPreview = { itemTitle?: string };

export async function buildToolPreview(
	args: unknown,
	app: Application,
	ctx: Context,
): Promise<ToolPreview | undefined> {
	const { catalogName, itemPath, fromItemPath, targetItemPath } = (args ?? {}) as {
		catalogName?: string;
		itemPath?: string;
		fromItemPath?: string;
		targetItemPath?: string;
	};
	const path = itemPath ?? fromItemPath ?? targetItemPath;
	if (!catalogName || !path) return undefined;

	try {
		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		const resolved = await CatalogItemLookup.resolve(catalog, catalogName, path);
		const itemTitle = resolved?.item.getTitle();
		return itemTitle ? { itemTitle } : undefined;
	} catch {
		return undefined;
	}
}
