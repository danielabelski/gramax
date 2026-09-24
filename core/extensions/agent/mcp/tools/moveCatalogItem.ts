import Path from "@core/FileProvider/Path/Path";
import type { Article } from "@core/FileStructue/Article/Article";
import type { Item } from "@core/FileStructue/Item/Item";
import type { ItemRef } from "@core/FileStructue/Item/ItemRef";
import { ItemType } from "@core/FileStructue/Item/ItemType";
import AgentResourcesProvider from "../../core/agentResourcesProvider";
import { LinkAdapter } from "../parser/adapters/linkAdapter";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { CatalogItemLookup } from "../utils/catalogPaths";

type MoveCatalogItemInput = {
	catalogName: string;
	fromItemPath: string;
	toItemPath: string;
};

export async function runMoveCatalogItem({ app, ctx, input }: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, fromItemPath, toItemPath } = input as MoveCatalogItemInput;
	if (AgentResourcesProvider.isSystemCatalog(catalogName)) {
		return fail("System catalog is read-only");
	}

	try {
		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		const sourceItem = CatalogItemLookup.findItem(catalog, fromItemPath);
		if (!sourceItem) {
			return fail("Item not found");
		}

		const fromRef = CatalogItemLookup.fromCatalogItem(catalog, sourceItem).asPath();
		const toRef = new Path(Path.join(catalog.name, LinkAdapter.toGramaxItemPath(toItemPath)));
		const targetType = LinkAdapter.isCategory(toItemPath) ? ItemType.category : ItemType.article;
		if (fromRef.compare(toRef)) {
			return fail("fromItemPath and toItemPath must be different");
		}

		if (CatalogItemLookup.findItem(catalog, toItemPath)) {
			return fail(`Target already exists`);
		}

		if (sourceItem.type === ItemType.category) {
			if (targetType === ItemType.article) {
				return fail("Converting category to article is not supported");
			}
			const sourceDir = sourceItem.ref.path.parentDirectoryPath;
			const targetDir = toRef.parentDirectoryPath;
			if (targetDir.startsWith(sourceDir)) {
				return fail("Cannot move category inside itself");
			}
		}

		const fromLookup = CatalogItemLookup.fromCatalogItem(catalog, sourceItem).asAgentJSON();
		const toItemRef: ItemRef = {
			path: toRef,
			storageId: sourceItem.ref.storageId,
		};
		const baseCatalog = catalog.deref;
		const resourceUpdater = app.resourceUpdaterFactory.withContext(ctx);

		let resultItem: Item;
		if (sourceItem.type !== targetType) {
			const category = await baseCatalog.createCategoryByArticle(resourceUpdater, sourceItem as Article);
			if (!category.ref.path.compare(toRef)) {
				resultItem = await baseCatalog.moveItem(category.ref, toItemRef, resourceUpdater, [category.ref]);
			} else {
				resultItem = category;
			}
		} else {
			resultItem = await baseCatalog.moveItem(sourceItem.ref, toItemRef, resourceUpdater, [sourceItem.ref]);
		}

		await app.wm.current().refreshCatalog(catalog.name);
		const refreshedCatalog = await app.wm.current().getCatalog(catalogName, ctx);
		const refreshedItem = refreshedCatalog.findItemByItemPath(resultItem.ref.path);
		if (!refreshedItem) {
			return fail(`Moved item not found after refresh. itemPath: ${toItemPath}`);
		}

		return ok(
			{
				type: refreshedItem.type,
				from: fromLookup,
				to: CatalogItemLookup.fromCatalogItem(refreshedCatalog, refreshedItem).asAgentJSON(),
			},
			{ refreshPage: true },
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to move item: ${msg}`);
	}
}
