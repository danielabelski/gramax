import { ResponseKind } from "@app/types/ResponseKind";
import assert from "assert";
import { Command } from "../../../types/Command";

const sessionRename: Command<{ sessionId: string; title: string }, { ok: true }> = Command.create({
	path: "agent/session/rename",

	kind: ResponseKind.json,

	async do({ sessionId, title }) {
		const renamed = await this._app.agentManager.sessions.rename(sessionId, title);
		assert(renamed, "agent/session/rename: session_not_found");
		return { ok: true as const };
	},

	params(_ctx, _q, body) {
		const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
		return {
			sessionId: String(payload.sessionId ?? ""),
			title: String(payload.title ?? "").trim(),
		};
	},
});

export default sessionRename;
