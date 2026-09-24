import { ResponseKind } from "@app/types/ResponseKind";
import { Command } from "../../../types/Command";

const secretsDelete: Command<{ key: string }, { ok: true }> = Command.create({
	path: "agent/secrets/delete",

	kind: ResponseKind.json,

	async do({ key }) {
		await this._app.agentManager.secrets.delete(key);
		return { ok: true as const };
	},

	params(_ctx, q) {
		return { key: String(q.key ?? "").trim() };
	},
});

export default secretsDelete;
