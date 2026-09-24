import Path from "@core/FileProvider/Path/Path";
import assert from "assert";
import { agentConfig } from "../../core/agentConfig";
import { LinkAdapter } from "../parser/adapters/linkAdapter";
import type { ToolExecutionContext } from "../tool";
import { HttpRequest } from "./httpRequest";

export type AttachmentPath =
	| { kind: "url"; url: string }
	| { kind: "attachment"; name: string }
	| { kind: "resource"; catalogName: string; articleItemPath: string; resourceName: string };

export class Attachment {
	private constructor() {}

	static parsePath(attachmentItemPath: string): AttachmentPath {
		const trimmed = attachmentItemPath
			.trim()
			.replace(/^<([\s\S]*)>$/, "$1")
			.trim();
		assert(trimmed, "attachmentItemPath is required");

		if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
			const parsed = new URL(trimmed);
			assert(
				parsed.protocol === "http:" || parsed.protocol === "https:",
				`Only http and https URLs are supported, got: ${parsed.protocol}`,
			);
			return { kind: "url", url: parsed.toString() };
		}

		const hashIndex = trimmed.indexOf("#");
		const path = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
		const normalized = path
			.trim()
			.replace(/^[/\\]+/, "")
			.replace(/\\/g, "/");
		const prefix = agentConfig.attachmentPrefix;
		const prefixIndex = normalized.indexOf(prefix);
		if (prefixIndex !== -1) {
			const name = new Path(
				normalized.slice(prefixIndex + prefix.length).replace(/^\/+/, ""),
			).nameWithExtension.replace(/[/\\]/g, "_");
			assert(name, "attachmentItemPath must be @attachments/<name.ext>");
			return { kind: "attachment", name };
		}

		const resource = LinkAdapter.parseResourceHref(path);
		assert(
			resource,
			"attachmentItemPath must be @attachments/<name.ext>, catalogName/itemPath@resources/<name.ext>, or http(s) URL",
		);
		return resource;
	}

	static async load(
		parsed: AttachmentPath,
		{ app, ctx, commands, sessionId }: ToolExecutionContext,
	): Promise<{ filename: string; bytes: Uint8Array }> {
		if (parsed.kind === "url") {
			const response = await HttpRequest.request({ url: parsed.url });
			assert(response.ok, `HTTP request failed: ${response.status} ${parsed.url}`);
			assert(response.bytes, "HTTP response has no bytes");
			const bytes = response.bytes;
			assert(
				bytes.byteLength <= agentConfig.maxAttachmentBytes,
				`Attachment exceeds max size: ${bytes.byteLength}`,
			);
			return { filename: response.filename, bytes };
		}

		if (parsed.kind === "attachment") {
			assert(sessionId, "Session is required for attachment");
			const bytes = await app.agentManager.attachments.getBytes(sessionId, parsed.name);
			assert(bytes, "Attachment not found");
			return { filename: parsed.name, bytes };
		}

		const getCmd = commands.article.resource.get;
		const res = (await getCmd.do(
			getCmd.params(
				ctx,
				{
					src: `./${parsed.resourceName}`,
					articlePath: Path.join(parsed.catalogName, LinkAdapter.toGramaxItemPath(parsed.articleItemPath)),
					catalogName: parsed.catalogName,
				},
				undefined,
			),
		)) as { hashItem?: { getContentAsBinary: () => Promise<Buffer> } } | undefined;
		assert(res?.hashItem, "Resource not found");
		return { filename: parsed.resourceName, bytes: Uint8Array.from(await res.hashItem.getContentAsBinary()) };
	}
}
