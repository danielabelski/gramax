import { ResponseKind } from "@app/types/ResponseKind";
import type Context from "@core/Context/Context";
import AgentResourcesProvider, { type AgentSkill } from "@ext/agent/core/agentResourcesProvider";
import { systemSkills } from "@ext/agent/prompts/skills/system-skills";
import { Command } from "../../../types/Command";

const skillsList: Command<{ ctx: Context; catalogName?: string }, { skills: AgentSkill[] }> = Command.create({
	path: "agent/skills/list",

	kind: ResponseKind.json,

	async do({ ctx, catalogName }) {
		if (AgentResourcesProvider.isSystemCatalog(catalogName)) {
			return { skills: systemSkills };
		}

		const catalog = await this._app.wm.current().getCatalog(catalogName, ctx);
		if (!catalog) {
			return { skills: [] };
		}

		return {
			skills: await catalog.customProviders.agentResourcesProvider.getSkills(this._app, ctx, this._commands),
		};
	},

	params(ctx, q) {
		return {
			ctx,
			catalogName: q.catalogName ? String(q.catalogName) : undefined,
		};
	},
});

export default skillsList;
