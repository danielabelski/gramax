import { agentConfig } from "../../core/agentConfig";
import { MCP_PROMPT_MAP } from "../../prompts/mcpPromptMap";
import { FileConverter, MarkdownDocumentParser } from "../parser";
import { LinkAdapter } from "../parser/adapters/linkAdapter";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { Attachment } from "../utils/attachment";
import { LineRange, type LineRangeInput } from "../utils/lines";

type ReadDocumentInput = LineRangeInput & {
	attachmentItemPath: string;
	headingId?: string;
};

export async function runReadDocument(context: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { attachmentItemPath, headingId, fromLine, toLine } = context.input as ReadDocumentInput;
	const range: LineRangeInput = { fromLine, toLine };
	try {
		LineRange.assertValid(range, headingId);

		const parsed = Attachment.parsePath(attachmentItemPath);
		const { filename, bytes } = await Attachment.load(parsed, context);
		const raw = await FileConverter.toAgentText(filename, bytes);
		const resolvedItemPath =
			parsed.kind === "attachment" ? LinkAdapter.toAgentAttachmentItemPath(filename) : attachmentItemPath.trim();

		if (LineRange.has(range)) {
			const slice = LineRange.apply(raw, range);
			if (slice.content.length > agentConfig.readMaxChars) {
				return ok({ message: MCP_PROMPT_MAP.readDocument.rangeTooLarge, totalLines: slice.totalLines });
			}
			return ok({ attachmentItemPath: resolvedItemPath, ...slice });
		}

		const content = headingId ? MarkdownDocumentParser.getHeadingSectionMarkdown(raw, headingId) : raw;
		if (content.length > agentConfig.readMaxChars) {
			return ok({
				message: MCP_PROMPT_MAP.readDocument.tooLarge,
				headings: MarkdownDocumentParser.getHeadingHierarchy(raw),
			});
		}

		return ok({
			attachmentItemPath: resolvedItemPath,
			content,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to read document: ${msg}`);
	}
}
