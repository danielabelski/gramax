import type { AgentDraftAttachment } from "../types/chat";

export const serializeAttachments = async (files: File[]): Promise<AgentDraftAttachment[]> => {
	const result: AgentDraftAttachment[] = [];
	await files.forEachAsync(async (file) => {
		const content = Buffer.from(new Uint8Array(await file.arrayBuffer())).toString("base64");
		result.push({
			name: file.name,
			mime: file.type || "application/octet-stream",
			size: file.size,
			content,
		});
	});
	return result;
};
