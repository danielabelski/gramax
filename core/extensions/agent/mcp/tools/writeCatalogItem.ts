import type { Article } from "@core/FileStructue/Article/Article";
import type { Category } from "@core/FileStructue/Category/Category";
import type ParseError from "@ext/markdown/core/Parser/Error/ParseError";
import AgentResourcesProvider from "../../core/agentResourcesProvider";
import { AgentArticleParser } from "../parser";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { updateCatalogItem, updateCatalogItemInUi } from "../utils/catalogItem";
import { CatalogItemLookup } from "../utils/catalogPaths";

type WriteCatalogItemInput = {
	catalogName: string;
	itemPath: string;
	content: string;
	headingId?: string;
};

export async function runWriteCatalogItem({
	app,
	ctx,
	commands,
	input,
	openCatalogName,
	openItemPath,
}: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, itemPath, content, headingId } = input as WriteCatalogItemInput;
	if (AgentResourcesProvider.isSystemCatalog(catalogName)) {
		return fail("System catalog is read-only");
	}
	try {
		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		const resolved = await CatalogItemLookup.resolve(catalog, catalogName, itemPath);
		if (!resolved) return fail(`Item not found`);
		const { item, lookup } = resolved;
		const parser = await AgentArticleParser.open(app, ctx, commands, catalog, item as Article | Category);
		const parsedContent = await updateCatalogItem(app, ctx, catalog, item, parser, content, headingId);
		if (openCatalogName === lookup.catalogName && openItemPath === lookup.itemPath) {
			await updateCatalogItemInUi(item, parsedContent, ctx, commands, catalog);
		}
		return ok(
			{
				...lookup.asAgentJSON(),
				...(headingId ? { headingId } : {}),
			},
			{ navChanged: true },
		);
	} catch (e) {
		const cause = (e as ParseError).cause;
		if (cause) {
			const msg = `Parse failed: ${cause.message}`;
			return fail(msg);
		}
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to write item: ${msg}`);
	}
}
