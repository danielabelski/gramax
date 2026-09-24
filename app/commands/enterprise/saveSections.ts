import { ResponseKind } from "@app/types/ResponseKind";
import type { HomeSections } from "@components/HomePage/utils/homeLayoutTypes";
import { mergeLayoutItems } from "@components/HomePage/utils/mergeSections";
import { parseSections, seenCatalogs } from "@components/HomePage/utils/parseSections";
import { resolveWorkspaceLayout } from "@components/HomePage/utils/workspaceLayout";
import type Context from "@core/Context/Context";
import EnterpriseApi from "@ext/enterprise/EnterpriseApi";
import { getEnterpriseSourceData } from "@ext/enterprise/utils/getEnterpriseSourceData";
import type { WorkspaceConfig, WorkspaceLayoutItem } from "@ext/workspace/WorkspaceConfig";
import assert from "assert";
import { Command } from "../../types/Command";

export const mergeEnterpriseLayout = (config: WorkspaceConfig, sections: HomeSections): WorkspaceLayoutItem[] =>
	mergeLayoutItems(resolveWorkspaceLayout(config).items, parseSections(sections), seenCatalogs(sections));

const saveSections: Command<{ ctx: Context; sections: HomeSections }, void> = Command.create({
	path: "enterprise/saveSections",

	kind: ResponseKind.none,

	async do({ ctx, sections }) {
		const workspace = await this._app.wm.current();
		const workspaceId = workspace.path();
		const config = this._app.wm.getWorkspaceConfig(workspaceId).config.inner();
		const gesUrl = config.enterprise?.gesUrl;
		const enterpriseSource = getEnterpriseSourceData(this._app.rp.getSourceDatas(ctx, workspaceId), gesUrl);

		assert(gesUrl && enterpriseSource?.token, "Enterprise workspace authentication is unavailable");

		await new EnterpriseApi(gesUrl).saveWorkspaceLayout(
			enterpriseSource.token,
			mergeEnterpriseLayout(config, sections),
		);
	},

	params(ctx, _q, body) {
		return { ctx, sections: body };
	},
});

export default saveSections;
