import Path from "@core/FileProvider/Path/Path";
import AgentResourcesProvider from "../../core/agentResourcesProvider";
import { FileConverter } from "../parser";
import { LinkAdapter } from "../parser/adapters/linkAdapter";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { Attachment } from "../utils/attachment";
import { CatalogItemLookup } from "../utils/catalogPaths";

type SaveChatAttachmentInput = {
	attachmentItemPath: string;
	catalogName: string;
	targetItemPath: string;
};

export async function runSaveChatAttachment({
	app,
	ctx,
	commands,
	input,
	sessionId,
}: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { attachmentItemPath, catalogName, targetItemPath } = input as SaveChatAttachmentInput;
	if (AgentResourcesProvider.isSystemCatalog(catalogName)) {
		return fail("System catalog is read-only");
	}
	try {
		const parsed = Attachment.parsePath(attachmentItemPath);
		if (parsed.kind !== "attachment") {
			return fail("attachmentItemPath must be @attachments/<name.ext>");
		}
		if (!sessionId) return fail("Session is required");

		const bytes = await app.agentManager.attachments.getBytes(sessionId, parsed.name);
		if (!bytes) return fail("Attachment not found");

		const catalog = await app.wm.current().getCatalog(catalogName, ctx);
		if (!catalog) return fail("Item not found");
		const item =
			targetItemPath === ""
				? catalog.getRootCategory()
				: (await CatalogItemLookup.resolve(catalog, catalogName, targetItemPath))?.item;
		if (!item) return fail("Item not found");

		const lookup = CatalogItemLookup.fromCatalogItem(catalog, item);
		const setCmd = commands.article.resource.set;
		const args = setCmd.params(
			ctx,
			{
				src: `./${parsed.name}`,
				articlePath: item.ref.path.value,
				catalogName,
				force: "false",
			},
			{ data: Buffer.from(bytes) },
		);
		const res = (await setCmd.do(args)) as { path?: string } | undefined;
		const savedPath = res?.path ?? `./${parsed.name}`;
		const savedName = new Path(savedPath).nameWithExtension;
		const articlePath = new Path(item.ref.path.value);
		const href = LinkAdapter.toAgentFileHref(
			articlePath,
			articlePath.parentDirectoryPath.join(new Path(savedName)),
		);
		const markdown = FileConverter.isImage(savedName) ? `![](${savedPath})` : `[${savedName}](${href})`;

		return ok({
			...lookup.asAgentJSON(),
			href,
			markdown,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to save attachment: ${msg}`);
	}
}
