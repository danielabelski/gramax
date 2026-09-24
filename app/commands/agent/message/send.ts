import { ResponseKind } from "@app/types/ResponseKind";
import type Context from "@core/Context/Context";
import { agentConfig } from "@ext/agent/core/agentConfig";
import type { AgentAttachmentInput } from "@ext/agent/core/attachmentStore";
import type { AgentQuote } from "@ext/agent/core/events";
import { type AgentLlmEndpoint, parseAgentLlmEndpoint } from "@ext/agent/llm";
import assert from "assert";
import { Command } from "../../../types/Command";

const messageSend: Command<
	{
		ctx: Context;
		sessionId: string;
		text: string;
		endpoint: AgentLlmEndpoint;
		attachments: AgentAttachmentInput[];
		quote?: AgentQuote;
		openCatalogName?: string;
		openItemPath?: string;
		useSkill?: string;
	},
	{ sessionId: string }
> = Command.create({
	path: "agent/message/send",

	kind: ResponseKind.json,

	async do({ ctx, sessionId, text, endpoint, attachments, quote, openCatalogName, openItemPath, useSkill }) {
		const session = this._app.agentManager.sessions.get(sessionId);
		assert(session, "agent/message/send: session_not_found");

		const trimmed = text.trim();
		assert(trimmed, "agent/message/send: empty_message");
		const llmClient = this._app.agentManager.getLlmClient(endpoint);

		const persistedAttachments =
			attachments.length > 0 ? await this._app.agentManager.attachments.put(sessionId, attachments) : [];

		await session.enqueueUserMessage(
			trimmed,
			persistedAttachments,
			llmClient,
			this._app,
			ctx,
			this._commands,
			openCatalogName,
			openItemPath,
			useSkill,
			quote,
		);

		await this._app.agentManager.sessions.clearDraft(sessionId).catch(() => {});

		return { sessionId };
	},

	params(ctx, _q, body) {
		const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
		const q = b.quote && typeof b.quote === "object" ? (b.quote as Record<string, unknown>) : null;
		const quote: AgentQuote | undefined = q?.text
			? {
					text: String(q.text).slice(0, agentConfig.readMaxChars),
					catalogName: q.catalogName ? String(q.catalogName) : undefined,
					itemPath: q.itemPath ? String(q.itemPath) : undefined,
				}
			: undefined;
		return {
			ctx,
			sessionId: String(b.sessionId ?? ""),
			text: String(b.text ?? ""),
			endpoint: parseAgentLlmEndpoint(b.endpoint),
			attachments: Array.isArray(b.attachments) ? (b.attachments as AgentAttachmentInput[]) : [],
			quote,
			openCatalogName: b.openCatalogName ? String(b.openCatalogName) : undefined,
			openItemPath: b.openItemPath ? String(b.openItemPath) : undefined,
			useSkill: b.useSkill ? String(b.useSkill) : undefined,
		};
	},
});

export default messageSend;
