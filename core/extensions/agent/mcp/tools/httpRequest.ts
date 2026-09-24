import { agentConfig } from "../../core/agentConfig";
import { AgentAttachmentStore } from "../../core/attachmentStore";
import { LinkAdapter } from "../parser/adapters/linkAdapter";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { HttpRequest } from "../utils/httpRequest";

export const HTTP_METHODS = HttpRequest.METHODS;

type HttpRequestInput = {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	auth?: { username: string; password: string };
};

export async function runHttpRequest({
	app,
	ctx,
	input,
	sessionId,
}: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { url, method: rawMethod, headers, body, auth } = input as HttpRequestInput;

	if (!url?.trim()) {
		return fail("url is required");
	}

	let method: (typeof HTTP_METHODS)[number];
	try {
		HttpRequest.normalizeUrl(url);
		method = HttpRequest.normalizeMethod(rawMethod);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(msg);
	}

	const requestHeaders = auth
		? {
				...headers,
				Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`,
			}
		: headers;
	const requestBody =
		method !== "GET" && body !== undefined ? await LinkAdapter.toExternal(body, app.wm, ctx.domain) : undefined;

	try {
		const result = await HttpRequest.request({
			url,
			method,
			headers: requestHeaders,
			body: requestBody !== undefined ? { type: "text", data: requestBody } : undefined,
		});

		if (!HttpRequest.isTextContentType(result.contentType) && result.bytes) {
			if (!sessionId) return fail("Session is required to store a binary HTTP response");
			if (result.bytes.byteLength > agentConfig.maxAttachmentBytes) {
				return fail(`Attachment exceeds max size: ${result.bytes.byteLength}`);
			}
			AgentAttachmentStore.assertAttachmentExtension(result.filename);
			const [saved] = await app.agentManager.attachments.put(sessionId, [
				{
					name: result.filename,
					mime: result.contentType ?? "application/octet-stream",
					size: result.bytes.byteLength,
					content: Buffer.from(result.bytes).toString("base64"),
					contentEncoding: "base64",
				},
			]);
			if (!saved) return fail("Failed to store binary HTTP response");
			return ok({
				status: result.status,
				statusText: result.statusText,
				ok: result.ok,
				attachmentItemPath: LinkAdapter.toAgentAttachmentItemPath(saved.originalFilename),
				mime: saved.mime,
				size: saved.size,
			});
		}

		return ok({
			status: result.status,
			statusText: result.statusText,
			ok: result.ok,
			body: result.body,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`HTTP request failed: ${msg}`);
	}
}
