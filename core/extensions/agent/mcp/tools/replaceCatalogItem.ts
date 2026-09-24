import type { Article } from "@core/FileStructue/Article/Article";
import type { Category } from "@core/FileStructue/Category/Category";
import type ParseError from "@ext/markdown/core/Parser/Error/ParseError";
import AgentResourcesProvider from "../../core/agentResourcesProvider";
import { AgentArticleParser } from "../parser";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { updateCatalogItem, updateCatalogItemInUi } from "../utils/catalogItem";
import { CatalogItemLookup } from "../utils/catalogPaths";

type ReplaceCatalogItemInput = {
	catalogName: string;
	itemPath: string;
	oldContent: string;
	newContent: string;
	replaceAll: boolean;
};

export async function runReplaceCatalogItem(context: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, itemPath, oldContent, newContent, replaceAll } = context.input as ReplaceCatalogItemInput;
	if (AgentResourcesProvider.isSystemCatalog(catalogName)) {
		return fail("System catalog is read-only");
	}
	if (!oldContent) {
		return fail("oldContent must be non-empty.");
	}

	const { app, ctx, commands, openCatalogName, openItemPath } = context;
	const catalog = await app.wm.current().getCatalog(catalogName, ctx);
	const resolved = await CatalogItemLookup.resolve(catalog, catalogName, itemPath);
	if (!resolved) {
		return fail("Item not found");
	}
	const { item, lookup } = resolved;

	const parser = await AgentArticleParser.open(app, ctx, commands, catalog, item as Article | Category);
	const source = await parser.getMarkdownForAgent();
	const parts = source.split(oldContent);
	const occurrences = parts.length - 1;

	if (occurrences === 0) {
		return fail("oldContent not found in document.");
	}
	if (!replaceAll && occurrences > 1) {
		return fail(
			`oldContent has multiple occurrences (${occurrences}). Set replaceAll=true or provide a more specific oldContent.`,
		);
	}

	const content = parts.join(newContent);
	try {
		const parsedContent = await updateCatalogItem(app, ctx, catalog, item, parser, content);
		if (openCatalogName === lookup.catalogName && openItemPath === lookup.itemPath) {
			await updateCatalogItemInUi(item, parsedContent, ctx, commands, catalog);
		}
	} catch (e) {
		const cause = (e as ParseError).cause;
		if (cause) {
			const msg = `Parse failed: ${cause.message}`;
			return fail(msg);
		}
		const msg = e instanceof Error ? e.message : String(e);
		return fail(msg);
	}

	return ok(
		{
			...lookup.asAgentJSON(),
			replacedCount: replaceAll ? occurrences : 1,
			replaceAll,
		},
		{ navChanged: true },
	);
}
