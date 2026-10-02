import type { Article } from "@core/FileStructue/Article/Article";
import type { Category } from "@core/FileStructue/Category/Category";
import { agentConfig } from "../../core/agentConfig";
import AgentResourcesProvider from "../../core/agentResourcesProvider";
import { MCP_PROMPT_MAP } from "../../prompts/mcpPromptMap";
import { AgentArticleParser } from "../parser";
import { MarkdownDocumentParser } from "../parser/markdownParser";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { CatalogItemLookup } from "../utils/catalogPaths";
import { LineRange, type LineRangeInput } from "../utils/lines";

type ReadCatalogItemInput = LineRangeInput & {
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
	const { catalogName, itemPath, headingId, fromLine, toLine } = input as ReadCatalogItemInput;
	const range: LineRangeInput = { fromLine, toLine };
	try {
		LineRange.assertValid(range, headingId);

		let lookup: CatalogItemLookup;
		let fullMarkdown: string;
		let headings: Promise<unknown> | unknown;

		const skill = await AgentResourcesProvider.getSkill(app, ctx, commands, catalogName, itemPath);
		if (skill) {
			lookup = new CatalogItemLookup(catalogName, itemPath, skill.name);
			fullMarkdown = skill.content;
			headings = MarkdownDocumentParser.getHeadingHierarchy(skill.content);
		} else {
			const catalog = await app.wm.current().getCatalog(catalogName, ctx);
			const resolved = await CatalogItemLookup.resolve(catalog, catalogName, itemPath);
			if (!resolved) return fail(`Item not found`);
			const { item } = resolved;
			lookup = resolved.lookup;

			const parser = await AgentArticleParser.open(app, ctx, commands, catalog, item as Article | Category);
			fullMarkdown = await parser.getMarkdownForAgent();
			headings = parser.getHeadingHierarchy();
		}

		if (LineRange.has(range)) {
			const slice = LineRange.apply(fullMarkdown, range);
			if (slice.content.length > agentConfig.readMaxChars) {
				return ok({ message: MCP_PROMPT_MAP.readCatalogItem.rangeTooLarge, totalLines: slice.totalLines });
			}
			return ok({ ...lookup.asAgentJSON(), ...slice });
		}

		const content = headingId
			? MarkdownDocumentParser.getHeadingSectionMarkdown(fullMarkdown, headingId)
			: fullMarkdown;

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
