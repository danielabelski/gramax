import { ResponseKind } from "@app/types/ResponseKind";
import type { HomeSections } from "@components/HomePage/utils/homeLayoutTypes";
import { mergeLayoutItems } from "@components/HomePage/utils/mergeSections";
import { parseSections, seenCatalogs } from "@components/HomePage/utils/parseSections";
import { resolveWorkspaceLayout, withWorkspaceLayoutItems } from "@components/HomePage/utils/workspaceLayout";
import { DesktopModeMiddleware } from "@core/Api/middleware/DesktopModeMiddleware";
import { Command } from "../../types/Command";

type SaveSectionsPayload = { sections: HomeSections; scope: "personal" | "global" };

const saveSections: Command<SaveSectionsPayload, void> = Command.create({
	path: "workspace/saveSections",

	kind: ResponseKind.json,

	middlewares: [new DesktopModeMiddleware()],

	async do(payload) {
		const wm = this._app.wm;
		const workspace = await wm.current();
		const { config } = wm.getWorkspaceConfig(workspace.path());
		const current = config.inner();

		const { sections, scope } = payload;
		const parsedItems = parseSections(sections);
		const layout = resolveWorkspaceLayout(current);
		const isGlobal = (!current.enterprise?.gesUrl && !current.enterpriseCloud?.url) || scope === "global";
		const previousItems = isGlobal ? layout.items : (layout.personal?.items ?? layout.items);
		const items = mergeLayoutItems(previousItems, parsedItems, seenCatalogs(sections));
		const next = withWorkspaceLayoutItems(current, items, isGlobal ? "global" : "personal");

		config.update(next);
		await config.save();
	},

	params(_ctx, _q, body) {
		return body;
	},
});

export default saveSections;
