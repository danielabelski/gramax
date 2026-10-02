import Path from "@core/FileProvider/Path/Path";
import { agentConfig } from "../../core/agentConfig";
import { MCP_PROMPT_MAP } from "../../prompts/mcpPromptMap";
import { FileConverter, MarkdownDocumentParser } from "../parser";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { CatalogItemLookup } from "../utils/catalogPaths";
import { LineRange, type LineRangeInput } from "../utils/lines";

type ReadFileInput = LineRangeInput & {
	catalogName: string;
	filePath: string;
	headingId?: string;
};

export async function runReadFile({ app, ctx, input }: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, filePath, headingId, fromLine, toLine } = input as ReadFileInput;
	const range: LineRangeInput = { fromLine, toLine };

	try {
		LineRange.assertValid(range, headingId);
		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		const wmFp = app.wm.current().getFileProvider();
		const normalizedFilePath = CatalogItemLookup.normalizePath(filePath ?? "");
		if (!normalizedFilePath) {
			return fail("filePath is required");
		}
		const resolvedPath = catalog.basePath.join(new Path(normalizedFilePath));
		if (!catalog.basePath.subDirectory(resolvedPath)) {
			return fail("Path resolves outside catalog root");
		}
		const repositoryRelativePath = catalog.getRepositoryRelativePath(resolvedPath).value;
		if (agentConfig.repoExcludedPathPatterns.some((pattern) => pattern.test(repositoryRelativePath))) {
			return fail("Path is excluded by repository access policy");
		}
		if (!(await wmFp.exists(resolvedPath))) {
			return fail("File not found");
		}
		if (await wmFp.isFolder(resolvedPath)) {
			return fail("Target path is a directory");
		}

		const fileName = resolvedPath.nameWithExtension;
		const raw = await FileConverter.toAgentText(fileName, Uint8Array.from(await wmFp.readAsBinary(resolvedPath)));

		if (LineRange.has(range)) {
			const slice = LineRange.apply(raw, range);
			if (slice.content.length > agentConfig.readMaxChars) {
				return ok({ message: MCP_PROMPT_MAP.readFile.rangeTooLarge, totalLines: slice.totalLines });
			}
			return ok({ catalogName, filePath: repositoryRelativePath, ...slice });
		}

		const content = headingId ? MarkdownDocumentParser.getHeadingSectionMarkdown(raw, headingId, false) : raw;

		if (content.length > agentConfig.readMaxChars) {
			return ok({
				message: MCP_PROMPT_MAP.readFile.tooLarge,
				headings: MarkdownDocumentParser.getHeadingHierarchy(raw, false),
			});
		}

		return ok({
			catalogName,
			filePath: repositoryRelativePath,
			content,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to read repository file: ${msg}`);
	}
}
