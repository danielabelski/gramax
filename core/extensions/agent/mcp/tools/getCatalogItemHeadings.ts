import type { Article } from "@core/FileStructue/Article/Article";
import type { Category } from "@core/FileStructue/Category/Category";
import AgentResourcesProvider from "../../core/agentResourcesProvider";
import { AgentArticleParser } from "../parser";
import { MarkdownDocumentParser } from "../parser/markdownParser";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { CatalogItemLookup } from "../utils/catalogPaths";

type GetCatalogItemHeadingsInput = {
	catalogName: string;
	itemPath: string;
};

export async function runGetCatalogItemHeadings({
	app,
	ctx,
	commands,
	input,
}: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, itemPath } = input as GetCatalogItemHeadingsInput;
	try {
		const skill = await AgentResourcesProvider.getSkill(app, ctx, commands, catalogName, itemPath);
		if (skill) {
			const lookup = new CatalogItemLookup(catalogName, itemPath, skill.name);
			return ok({
				...lookup.asAgentJSON(),
				headings: MarkdownDocumentParser.getHeadingHierarchy(skill.content),
			});
		}

		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		const resolved = await CatalogItemLookup.resolve(catalog, catalogName, itemPath);
		if (!resolved) return fail(`Item not found`);
		const { item, lookup } = resolved;
		const parser = await AgentArticleParser.open(app, ctx, commands, catalog, item as Article | Category);
		return ok({
			...lookup.asAgentJSON(),
			headings: await parser.getHeadingHierarchy(),
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to read headings from item: ${msg}`);
	}
}
