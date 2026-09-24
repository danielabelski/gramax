import { ResponseKind } from "@app/types/ResponseKind";
import type Context from "@core/Context/Context";
import assert from "assert";
import { GesCloudApi } from "../../../core/extensions/enterprise-cloud/GesCloudApi";
import {
	INIT_NEW_CATALOG_REPOSITORY_ALREADY_EXISTS,
	type PrepareNewCatalogResult,
} from "../../../core/extensions/enterprise-cloud/logic/Catalog/InitNewCatalogResult";
import { makeSourceApi } from "../../../core/extensions/git/actions/Source/makeSourceApi";
import type GitSourceData from "../../../core/extensions/git/core/model/GitSourceData.schema";
import type GitStorageData from "../../../core/extensions/git/core/model/GitStorageData";
import SourceType from "../../../core/extensions/storage/logic/SourceDataProvider/model/SourceType";
import CatalogExistsError from "../../../core/extensions/storage/models/CatalogExistsError";
import { Command } from "../../types/Command";

const prepareNewCatalog: Command<
	{ ctx: Context; oldCatalogName: string; newCatalogTitle: string; newRepositoryName: string },
	PrepareNewCatalogResult
> = Command.create({
	path: "enterpriseCloud/prepareNewCatalog",

	kind: ResponseKind.json,

	async do({ ctx, oldCatalogName, newCatalogTitle, newRepositoryName }) {
		if (!oldCatalogName) throw new Error("oldCatalogName is required");
		if (!newRepositoryName) throw new Error("newRepositoryName is required");

		const workspace = this._app.wm.current();
		const catalog = await workspace.getCatalog(oldCatalogName, ctx);
		assert(catalog, `Catalog not found: ${oldCatalogName}`);

		const localCatalogRepositoryNames = Array.from(workspace.getAllCatalogs().values())
			.filter((catalog) => !catalog.repo.storage?.getSourceName() && catalog.name !== oldCatalogName)
			.map((catalog) => catalog.name);

		if (localCatalogRepositoryNames.includes(newRepositoryName)) {
			return { success: false, errorCode: INIT_NEW_CATALOG_REPOSITORY_ALREADY_EXISTS };
		}

		const sourceDatas = this._app.rp.getSourceDatas(ctx, workspace.path());
		const gitlabSourceData = sourceDatas.find((sourceData) => sourceData.sourceType === SourceType.gitLab);
		const gesCloudApi = new GesCloudApi((await this._app.enterpriseCloudManager.getConfig()).url);
		const initData = await gesCloudApi.getCatalogInitData();

		const data: GitStorageData = {
			source: gitlabSourceData as GitSourceData,
			name: newRepositoryName,
			group: initData.git.group,
		};

		try {
			await makeSourceApi(data.source).assertStorageExist(data);
		} catch (error) {
			if (error instanceof CatalogExistsError) {
				return { success: false, errorCode: INIT_NEW_CATALOG_REPOSITORY_ALREADY_EXISTS };
			}

			throw error;
		}

		if (catalog.props.title !== newCatalogTitle || oldCatalogName !== newRepositoryName) {
			const catalogProps = await this._commands.catalog.updateProps.do({
				ctx,
				catalogName: oldCatalogName,
				props: { title: newCatalogTitle, url: newRepositoryName },
			});
			assert(catalogProps, `Catalog not found: ${oldCatalogName}`);
			return {
				success: true,
				catalogProps,
				data: { name: data.name, group: data.group },
			};
		}

		return {
			success: true,
			catalogProps: await this._app.sitePresenterFactory.fromContext(ctx).serializeCatalogProps(catalog),
			data: { name: data.name, group: data.group },
		};
	},

	params(ctx, q) {
		return {
			ctx,
			oldCatalogName: decodeURIComponent(q.oldCatalogName ?? "").trim(),
			newCatalogTitle: decodeURIComponent(q.newCatalogTitle ?? "").trim(),
			newRepositoryName: decodeURIComponent(q.newRepositoryName ?? "").trim(),
		};
	},
});

export default prepareNewCatalog;
