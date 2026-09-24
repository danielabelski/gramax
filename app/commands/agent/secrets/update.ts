import { ResponseKind } from "@app/types/ResponseKind";
import type { AgentSecret } from "@ext/agent/mcp/agentSecretStore";
import assert from "assert";
import { Command } from "../../../types/Command";

const secretsUpdate: Command<{ oldKey: string; key: string; secret: AgentSecret }, { ok: true }> = Command.create({
	path: "agent/secrets/update",

	kind: ResponseKind.json,

	async do({ oldKey, key, secret }) {
		await this._app.agentManager.secrets.update(oldKey, key, secret);
		return { ok: true as const };
	},

	params(_ctx, _q, body) {
		const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
		const secret = payload.secret as AgentSecret;
		assert(secret && (secret.type === "token" || secret.type === "login"));
		return {
			oldKey: String(payload.oldKey ?? "").trim(),
			key: String(payload.key ?? "").trim(),
			secret,
		};
	},
});

export default secretsUpdate;
