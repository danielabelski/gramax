import { UNIQUE_NAME_SEPARATOR } from "@app/config/const";
import Path from "@core/FileProvider/Path/Path";
import { uniqueName } from "@core/utils/uniqueName";
import assert from "assert";
import { agentConfig } from "./agentConfig";
import type { AgentFileStore } from "./agentFileStore";

export type AgentAttachment = {
	originalFilename: string;
	storagePath: string;
	size: number;
	mime: string;
};

export type AgentAttachmentInput = {
	name: string;
	mime: string;
	size: number;
	content: string;
	contentEncoding?: "utf-8" | "base64";
};

export class AgentAttachmentStore {
	constructor(private readonly _fileStore: AgentFileStore) {}

	async put(sessionId: string, attachments: AgentAttachmentInput[]): Promise<AgentAttachment[]> {
		if (!attachments.length) return [];

		const result: AgentAttachment[] = [];
		const writtenPaths: string[] = [];
		const existing = await this._fileStore.listDir(this._dir(sessionId));

		try {
			for (const attachment of attachments) {
				const uniqueFilename = await this._allocateFilename(attachment.name, existing);
				AgentAttachmentStore.assertAttachmentExtension(uniqueFilename);
				const bytes = AgentAttachmentStore._toBytes(attachment);
				assert(
					bytes.byteLength <= agentConfig.maxAttachmentBytes,
					`Attachment exceeds max size: ${bytes.byteLength}`,
				);

				const relativePath = this._getFilePath(sessionId, uniqueFilename);
				await this._fileStore.writeFile(relativePath, Buffer.from(bytes).toString("base64"));
				writtenPaths.push(relativePath);
				existing.push(uniqueFilename);

				result.push({
					originalFilename: uniqueFilename,
					storagePath: relativePath,
					size: bytes.byteLength,
					mime: attachment.mime,
				});
			}

			return result;
		} catch (err) {
			await writtenPaths.forEachAsync((path) => this._fileStore.deletePath(path));
			throw err;
		}
	}

	async get(sessionId: string, attachmentName: string): Promise<string | null> {
		return this._fileStore.readFile(this._getFilePath(sessionId, attachmentName));
	}

	async getBytes(sessionId: string, attachmentName: string): Promise<Uint8Array | null> {
		const raw = await this.get(sessionId, attachmentName);
		if (raw == null) return null;
		return Uint8Array.from(Buffer.from(raw, "base64"));
	}

	static assertAttachmentExtension(filename: string): void {
		const ext = new Path(filename).extension?.toLowerCase() ?? "";
		assert(
			ext && agentConfig.allowedAttachmentExtensions.includes(ext),
			`Unsupported attachment extension: ${ext || "(none)"}`,
		);
	}

	private _dir(sessionId: string): string {
		return `sessions/${sessionId}/attachments`;
	}

	private _getFilePath(sessionId: string, name: string): string {
		const fileName = new Path(name).nameWithExtension.replace(/[/\\]/g, "_");
		return `${this._dir(sessionId)}/${fileName}`;
	}

	private async _allocateFilename(name: string, existing: string[]): Promise<string> {
		const path = new Path(name.replace(/[/\\]/g, "_"));
		const extension = path.extension?.toLowerCase() ?? "";
		const base = path.name || "download";
		const postfix = extension ? `.${extension}` : "";
		const names = existing.map((item) => `./${item}`);
		return uniqueName(`./${base}`, names, postfix, UNIQUE_NAME_SEPARATOR, true).replace(/^\.\//, "");
	}

	private static _toBytes(attachment: AgentAttachmentInput): Uint8Array {
		const encoding = attachment.contentEncoding === "utf-8" ? "utf8" : "base64";
		return Uint8Array.from(Buffer.from(attachment.content, encoding));
	}
}
