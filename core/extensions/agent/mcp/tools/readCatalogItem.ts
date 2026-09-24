import type { Article } from "@core/FileStructue/Article/Article";
import type { Category } from "@core/FileStructue/Category/Category";
import { agentConfig } from "../../core/agentConfig";
import AgentResourcesProvider from "../../core/agentResourcesProvider";
import { MCP_PROMPT_MAP } from "../../prompts/mcpPromptMap";
import { AgentArticleParser } from "../parser";
import { MarkdownDocumentParser } from "../parser/markdownParser";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { CatalogItemLookup } from "../utils/catalogPaths";

type ReadCatalogItemInput = {
	catalogName: string;
	itemPath: string;
	headingId?: string;
};

export async function runReadCatalogItem({
	app,
	ctx,
	commands,
	input,
}: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, itemPath, headingId } = input as ReadCatalogItemInput;
	try {
		let lookup: CatalogItemLookup;
		let content: string;
		let headings: Promise<unknown> | unknown;

		const skill = await AgentResourcesProvider.getSkill(app, ctx, commands, catalogName, itemPath);
		if (skill) {
			lookup = new CatalogItemLookup(catalogName, itemPath, skill.name);
			content = headingId
				? MarkdownDocumentParser.getHeadingSectionMarkdown(skill.content, headingId)
				: skill.content;
			headings = MarkdownDocumentParser.getHeadingHierarchy(skill.content);
		} else {
			const catalog = await app.wm.current().getCatalog(catalogName, ctx);
			const resolved = await CatalogItemLookup.resolve(catalog, catalogName, itemPath);
			if (!resolved) return fail(`Item not found`);
			const { item } = resolved;
			lookup = resolved.lookup;

			const parser = await AgentArticleParser.open(app, ctx, commands, catalog, item as Article | Category);
			content = headingId ? await parser.getMarkdownForHeading(headingId) : await parser.getMarkdownForAgent();
			headings = parser.getHeadingHierarchy();
		}

		if (content.length > agentConfig.readMaxChars) {
			return ok({
				message: MCP_PROMPT_MAP.readCatalogItem.tooLarge,
				headings: await headings,
			});
		}
		return ok({ ...lookup.asAgentJSON(), content });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to read item: ${msg}`);
	}
}
