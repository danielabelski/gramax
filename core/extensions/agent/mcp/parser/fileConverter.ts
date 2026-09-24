import resolveModule from "@app/resolveModule/frontend";
import Path from "@core/FileProvider/Path/Path";
import assert from "assert";
import { agentConfig } from "../../core/agentConfig";

export class FileConverter {
	private constructor() {}

	static isConvertible(fileName: string): boolean {
		return this._hasExtension(fileName, agentConfig.convertibleAttachmentExtensions);
	}

	static isBinaryAttachment(fileName: string): boolean {
		return this._hasExtension(fileName, agentConfig.binaryAttachmentExtensions);
	}

	static isImage(fileName: string): boolean {
		return this._hasExtension(fileName, agentConfig.imageAttachmentExtensions);
	}

	static async toAgentText(fileName: string, bytes: Uint8Array): Promise<string> {
		const extension = this._getFileExtension(fileName);
		switch (extension) {
			case "docx":
				return this._parseDocx(bytes);
			case "xlsx":
				return this._parseXlsx(bytes);
			case "pdf":
				return this._parsePdf(bytes);
			default:
				assert(
					!this.isBinaryAttachment(fileName) && !this.isImage(fileName),
					`Cannot read this file type: ${extension || "(none)"}`,
				);
				return new TextDecoder("utf-8").decode(bytes);
		}
	}

	private static _getFileExtension(fileName: string): string {
		return new Path(fileName).extension?.toLowerCase() ?? "";
	}

	private static _hasExtension(fileName: string, extensions: string[]): boolean {
		const extension = this._getFileExtension(fileName);
		return !!extension && extensions.includes(extension);
	}

	private static async _parseDocx(bytes: Uint8Array): Promise<string> {
		const mammoth = await import("mammoth");
		const arrayBuffer = Uint8Array.from(bytes).buffer as ArrayBuffer;
		const result = await mammoth.extractRawText({ arrayBuffer });
		return result.value.trim();
	}

	private static async _parseXlsx(bytes: Uint8Array): Promise<string> {
		const xlsxLib = await import("@e965/xlsx");
		const workbook = xlsxLib.read(bytes, { type: "array" });
		const sections: string[] = [];
		for (const sheetName of workbook.SheetNames) {
			const worksheet = workbook.Sheets[sheetName];
			if (!worksheet) continue;
			const csv = xlsxLib.utils.sheet_to_csv(worksheet, { blankrows: false }).trim();
			if (!csv) continue;
			sections.push(`# ${sheetName}\n${csv}`);
		}
		return sections.join("\n\n").trim();
	}

	private static async _parsePdf(bytes: Uint8Array): Promise<string> {
		const pdfjs = await resolveModule("getPdfjs")();
		const document = await pdfjs.getDocument({
			data: Uint8Array.from(bytes),
			verbosity: 0,
		}).promise;
		const pages: string[] = [];
		for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex++) {
			const page = await document.getPage(pageIndex);
			const textContent = await page.getTextContent();
			const parts: string[] = [];
			for (const item of textContent.items) {
				if (!("str" in item)) continue;
				parts.push(item.str);
			}
			const text = parts.join(" ").trim();
			if (!text) continue;
			pages.push(text);
		}
		return pages.join("\n\n").trim();
	}
}
