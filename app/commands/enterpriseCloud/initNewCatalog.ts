import { ResponseKind } from "@app/types/ResponseKind";
import type Context from "@core/Context/Context";
import type GitSourceData from "@ext/git/core/model/GitSourceData.schema";
import type GitStorageData from "@ext/git/core/model/GitStorageData";
import SourceType from "@ext/storage/logic/SourceDataProvider/model/SourceType";
import assert from "assert";
import type {
	InitNewCatalogResult,
	PreparedGitStorageData,
} from "../../../core/extensions/enterprise-cloud/logic/Catalog/InitNewCatalogResult";
import { Command } from "../../types/Command";

const initNewCatalog: Command<
	{ ctx: Context; repositoryName: string; data: PreparedGitStorageData },
	InitNewCatalogResult
> = Command.create({
	path: "enterpriseCloud/initNewCatalog",

	kind: ResponseKind.json,

	async do({ ctx, repositoryName, data }) {
		const { wm, rp, sitePresenterFactory } = this._app;
		if (!repositoryName) throw new Error("repositoryName is required");

		const workspace = wm.current();
		const catalog = await workspace.getCatalog(repositoryName, ctx);
		assert(catalog, `Catalog not found: ${repositoryName}`);

		const sourceDatas = rp.getSourceDatas(ctx, workspace.path());
		const gitlabSourceData = sourceDatas.find((sourceData) => sourceData.sourceType === SourceType.gitLab);
		assert(gitlabSourceData, "GitLab source data is required");

		const storageData: GitStorageData = {
			...data,
			source: gitlabSourceData as GitSourceData,
		};

		await this._commands.versionControl.init.do({
			ctx,
			data: storageData,
			catalogName: repositoryName,
		});

		return {
			success: true,
			catalogProps: await sitePresenterFactory.fromContext(ctx).serializeCatalogProps(catalog),
		};
	},

	params(ctx, q, body) {
		assert(typeof body?.name === "string" && body.name, "name is required");
		assert(typeof body?.group === "string" && body.group, "group is required");

		return {
			ctx,
			repositoryName: decodeURIComponent(q.repositoryName ?? "").trim(),
			data: body as PreparedGitStorageData,
		};
	},
});

export default initNewCatalog;
