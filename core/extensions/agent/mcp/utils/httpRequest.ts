import { getExecutingEnvironment } from "@app/resolveModule/env";
import resolveModule from "@app/resolveModule/frontend";
import Path from "@core/FileProvider/Path/Path";
import assert from "assert";
import { agentConfig } from "../../core/agentConfig";

export type HttpMethod = (typeof HttpRequest.METHODS)[number];

export type HttpMultipartField =
	| { name: string; value: string }
	| { name: string; filename: string; mime: string; data: Uint8Array };

export type HttpRequestBody = { type: "text"; data: string } | { type: "multipart"; fields: HttpMultipartField[] };

export type HttpRequestOptions = {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: HttpRequestBody;
	timeoutMs?: number;
};

export type HttpRequestResult = {
	status: number;
	statusText: string;
	ok: boolean;
	body: string;
	filename: string;
	contentType?: string;
	bytes?: Uint8Array;
};

export class HttpRequest {
	private constructor() {}

	static readonly METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "REPORT"] as const;

	static normalizeMethod(method?: string): HttpMethod {
		const nextMethod = (method ?? "GET").toUpperCase();
		assert(HttpRequest.METHODS.includes(nextMethod as HttpMethod), `Unsupported method: ${method ?? nextMethod}`);
		return nextMethod as HttpMethod;
	}

	static normalizeUrl(url: string): string {
		const parsed = new URL(url);
		assert(parsed.protocol === "http:" || parsed.protocol === "https:", `Unsupported protocol: ${parsed.protocol}`);
		return parsed.toString();
	}

	static isTextContentType(contentType?: string | null): boolean {
		if (!contentType) return true;
		const mime = contentType.split(";")[0].trim().toLowerCase();
		if (mime.startsWith("text/") || mime.endsWith("+json") || mime.endsWith("+xml")) return true;
		return (
			mime === "application/json" ||
			mime === "application/xml" ||
			mime === "application/javascript" ||
			mime === "application/ecmascript" ||
			mime === "application/yaml" ||
			mime === "application/x-yaml" ||
			mime === "application/x-ndjson" ||
			mime === "application/x-www-form-urlencoded"
		);
	}

	static async request(options: HttpRequestOptions): Promise<HttpRequestResult> {
		const method = HttpRequest.normalizeMethod(options.method);
		const url = HttpRequest.normalizeUrl(options.url);
		const headers = { ...(options.headers ?? {}) };
		const timeoutMs = options.timeoutMs ?? agentConfig.httpRequestTimeoutMs;

		let body: BodyInit | undefined;
		if (options.body?.type === "multipart") {
			for (const key of Object.keys(headers)) {
				if (key.toLowerCase() === "content-type") delete headers[key];
			}
			body = HttpRequest._formData(options.body.fields);
		} else if (method !== "GET" && options.body?.type === "text") {
			body = options.body.data;
		}

		if (getExecutingEnvironment() === "tauri" && options.body?.type !== "multipart") {
			const response = await resolveModule("httpFetch")(
				url,
				{ method, headers, body },
				{ timeout: { type: "on", ms: timeoutMs } },
			);
			if (response) return HttpRequest._fromResponse(url, response);
		}

		return HttpRequest._fetch(url, method, headers, body, timeoutMs);
	}

	private static _formData(fields: HttpMultipartField[]): FormData {
		const formData = new FormData();
		for (const field of fields) {
			if ("value" in field) {
				formData.append(field.name, field.value);
				continue;
			}
			const bytes = new Uint8Array(field.data.byteLength);
			bytes.set(field.data);
			formData.append(field.name, new Blob([bytes], { type: field.mime }), field.filename);
		}
		return formData;
	}

	private static async _fetch(
		url: string,
		method: string,
		headers: Record<string, string>,
		body?: BodyInit,
		timeoutMs?: number,
	): Promise<HttpRequestResult> {
		const signal =
			timeoutMs != null && typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
				? AbortSignal.timeout(timeoutMs)
				: undefined;
		return HttpRequest._fromResponse(url, await fetch(url, { method, headers, body, signal }));
	}

	private static async _fromResponse(url: string, response: Response): Promise<HttpRequestResult> {
		const contentType = response.headers.get("content-type") ?? undefined;
		const contentDisposition = response.headers.get("content-disposition") ?? undefined;
		const contentLengthHeader = response.headers.get("content-length");
		if (contentLengthHeader != null) {
			const contentLength = Number(contentLengthHeader);
			if (Number.isFinite(contentLength)) {
				assert(
					contentLength <= agentConfig.maxAttachmentBytes,
					`Attachment exceeds max size: ${contentLength}`,
				);
			}
		}
		const base = {
			status: response.status,
			statusText: response.statusText ?? "",
			ok: response.status >= 200 && response.status < 300,
			filename: HttpRequest._filename(url, contentDisposition),
			contentType,
		};
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (HttpRequest.isTextContentType(contentType)) {
			return { ...base, body: new TextDecoder().decode(bytes), bytes };
		}
		return bytes.byteLength ? { ...base, body: "", bytes } : { ...base, body: "" };
	}

	private static _filename(url: string, contentDisposition?: string): string {
		const fromHeader = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(contentDisposition ?? "")?.[1];
		const fromUrl = new Path(new URL(url).pathname).nameWithExtension;
		const name = (fromHeader ? decodeURIComponent(fromHeader.trim()) : fromUrl).replace(/[/\\]/g, "_");
		return new Path(name).extension ? name : "download.bin";
	}
}
