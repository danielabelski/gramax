import { ResponseKind } from "@app/types/ResponseKind";
import type { AgentSecret } from "@ext/agent/mcp/agentSecretStore";
import assert from "assert";
import { Command } from "../../../types/Command";

const secretsSet: Command<{ key: string; secret: AgentSecret }, { ok: true }> = Command.create({
	path: "agent/secrets/set",

	kind: ResponseKind.json,

	async do({ key, secret }) {
		await this._app.agentManager.secrets.set(key, secret);
		return { ok: true as const };
	},

	params(_ctx, _q, body) {
		const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
		const secret = payload.secret as AgentSecret;
		assert(secret && (secret.type === "token" || secret.type === "login"));
		return {
			key: String(payload.key ?? "").trim(),
			secret,
		};
	},
});

export default secretsSet;
