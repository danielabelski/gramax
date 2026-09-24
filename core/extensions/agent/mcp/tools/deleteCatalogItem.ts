import ArticleParser from "@core/FileStructue/Article/ArticleParser";
import AgentResourcesProvider from "../../core/agentResourcesProvider";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { CatalogItemLookup } from "../utils/catalogPaths";

type DeleteCatalogItemInput = {
	catalogName: string;
	itemPath: string;
};

export async function runDeleteCatalogItem({ app, ctx, input }: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, itemPath } = input as DeleteCatalogItemInput;
	if (AgentResourcesProvider.isSystemCatalog(catalogName)) {
		return fail("System catalog is read-only");
	}
	try {
		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		const normalized = CatalogItemLookup.normalizePath(itemPath);
		const resolved = await CatalogItemLookup.resolve(catalog, catalogName, itemPath);
		if (!resolved) return fail(`Item not found`);
		const { item, lookup } = resolved;
		if (AgentResourcesProvider.isSkillItemPath(normalized)) {
			await catalog.customProviders.agentResourcesProvider.remove(
				item.ref.path.name,
				app.parser,
				app.parserContextFactory,
				ctx,
			);
		} else {
			const parser = new ArticleParser(ctx, app.parser, app.parserContextFactory);
			await catalog.deleteItem(item.ref, parser, false);
		}
		return ok(lookup.asAgentJSON(), { refreshPage: true });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to delete item: ${msg}`);
	}
}
