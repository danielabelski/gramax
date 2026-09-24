import { ResponseKind } from "@app/types/ResponseKind";
import type { AgentSecret } from "@ext/agent/mcp/agentSecretStore";
import { Command } from "../../../types/Command";

const secretsList: Command<{ includeValues: boolean }, { secrets: Record<string, AgentSecret> }> = Command.create({
	path: "agent/secrets/list",

	kind: ResponseKind.json,

	async do({ includeValues }) {
		await this._app.agentManager.secrets.load();
		return { secrets: this._app.agentManager.secrets.list(includeValues) };
	},

	params(_ctx, q) {
		return { includeValues: q.includeValues === "true" };
	},
});

export default secretsList;
