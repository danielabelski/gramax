import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type ContextualCatalog from "@core/FileStructue/Catalog/ContextualCatalog";
import type { Category } from "@core/FileStructue/Category/Category";
import type { Item } from "@core/FileStructue/Item/Item";
import { ItemType } from "@core/FileStructue/Item/ItemType";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { CatalogItemLookup } from "../utils/catalogPaths";

type NavigationNode = ReturnType<CatalogItemLookup["asAgentJSON"]> & { type: string; children?: NavigationNode[] };

async function serializeTree(catalog: Catalog | ContextualCatalog, item: Item): Promise<NavigationNode> {
	const lookup = CatalogItemLookup.fromCatalogItem(catalog, item);
	const base = {
		type: item.type,
		...lookup.asAgentJSON(),
	};
	if (item.type !== ItemType.category) return base;
	const children = await Promise.all(((item as Category).items ?? []).map((it) => serializeTree(catalog, it)));
	return {
		...base,
		children,
	};
}

type GetNavigationInput = {
	catalogName: string;
	itemPath?: string;
};

export async function runGetNavigation({ app, ctx, input }: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, itemPath } = input as GetNavigationInput;
	const startPathRaw = itemPath?.trim() ?? "";
	try {
		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		let startNode: Item;
		if (!startPathRaw) {
			startNode = catalog.getRootCategory();
		} else {
			const item = CatalogItemLookup.findItem(catalog, startPathRaw);
			if (!item) return fail(`Start item not found`);
			startNode = item;
		}
		const tree = await serializeTree(catalog, startNode);
		return ok({
			root: {
				type: tree.type,
				catalogName: tree.catalogName,
				itemPath: tree.itemPath,
				title: tree.title,
			},
			tree,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to build navigation: ${msg}`);
	}
}
