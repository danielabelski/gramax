import { getExecutingEnvironment } from "@app/resolveModule/env";
import applyWorkspaceServices from "@app/utils/applyWorkspaceServices";
import type PageDataContext from "@core/Context/PageDataContext";
import type { HomePageData } from "@core/SitePresenter/SitePresenter";
import type { HomePageDataParams } from "@core/SitePresenter/types/PageDataParams";
import { getGesWebWorkspacePath } from "@ext/enterprise/utils/getGesWebWorkspacePath";
import { Command } from "../../types/Command";
import getPageDataContext from "./getPageDataContext";

const getHomePageData: Command<HomePageDataParams, { data: HomePageData; context: PageDataContext }> = Command.create({
	path: "page/getHomePageData",

	flags: ["otel-omit-result"],

	async do({ ctx, path }) {
		const { wm, sitePresenterFactory } = this._app;
		const gesWorkspacePath = getGesWebWorkspacePath(
			getExecutingEnvironment(),
			this._app.em.getConfig().gesUrl,
			wm.workspaces(),
		);
		if (gesWorkspacePath && wm.maybeCurrent()?.path() !== gesWorkspacePath) {
			await wm.setWorkspace(gesWorkspacePath);
			applyWorkspaceServices(this._app.settings, wm.current());
		}

		if (!wm.hasWorkspace()) {
			const section = { title: "", href: "", catalogLinks: [] };
			const view = { section, breadcrumb: [], group: null };
			return {
				data: {
					catalogsLinks: [],
					hasPersonalOverride: false,
					views: { global: view, personal: view },
				},
				context: await getPageDataContext({ ctx, app: this._app, isArticle: false }),
			};
		}

		const workspace = wm.current();
		const dataProvider = sitePresenterFactory.fromContext(ctx);
		const data = await dataProvider.getHomePageData(await workspace.config(), path);
		const context = await getPageDataContext({
			ctx,
			app: this._app,
			isArticle: false,
			isReadOnly: this._app.conf.isReadOnly,
		});

		return {
			data,
			context,
		};
	},

	params(ctx, q) {
		const path = q.path;
		return { ctx, path };
	},
});

export default getHomePageData;
