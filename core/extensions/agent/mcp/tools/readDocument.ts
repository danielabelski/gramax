import { agentConfig } from "../../core/agentConfig";
import { MCP_PROMPT_MAP } from "../../prompts/mcpPromptMap";
import { FileConverter, MarkdownDocumentParser } from "../parser";
import { LinkAdapter } from "../parser/adapters/linkAdapter";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { Attachment } from "../utils/attachment";

type ReadDocumentInput = {
	attachmentItemPath: string;
	headingId?: string;
};

export async function runReadDocument(context: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { attachmentItemPath, headingId } = context.input as ReadDocumentInput;
	try {
		const parsed = Attachment.parsePath(attachmentItemPath);
		const { filename, bytes } = await Attachment.load(parsed, context);
		const raw = await FileConverter.toAgentText(filename, bytes);
		const content = headingId ? MarkdownDocumentParser.getHeadingSectionMarkdown(raw, headingId) : raw;
		if (content.length > agentConfig.readMaxChars) {
			return ok({
				message: MCP_PROMPT_MAP.readDocument.tooLarge,
				headings: MarkdownDocumentParser.getHeadingHierarchy(raw),
			});
		}

		return ok({
			attachmentItemPath:
				parsed.kind === "attachment"
					? LinkAdapter.toAgentAttachmentItemPath(filename)
					: attachmentItemPath.trim(),
			content,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to read document: ${msg}`);
	}
}
