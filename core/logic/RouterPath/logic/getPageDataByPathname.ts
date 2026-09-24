import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type PathnameData from "@core/RouterPath/model/PathnameData";
import RouterPathProvider from "@core/RouterPath/RouterPathProvider";
import type GitStorage from "@ext/git/core/GitStorage/GitStorage";
import isGitSourceType from "@ext/storage/logic/SourceDataProvider/logic/isGitSourceType";
import type Storage from "@ext/storage/logic/Storage";
import type WorkspaceManager from "@ext/workspace/WorkspaceManager";

export enum PageDataType {
	article = "article",
	notFound = "notFound",
	home = "home",
}

const getPageDataByPathname = async (
	pathnameData: PathnameData,
	wm: WorkspaceManager,
): Promise<{ type: PageDataType; itemLogicPath?: string[] }> => {
	if (!wm.maybeCurrent()) return { type: PageDataType.home, itemLogicPath: pathnameData.itemLogicPath };

	if (RouterPathProvider.isLocal(pathnameData)) {
		if (await wm.getCatalogOrFindAtAnyWorkspace(pathnameData.catalogName))
			return { type: PageDataType.article, itemLogicPath: pathnameData.itemLogicPath };
		return { type: PageDataType.notFound };
	}
	if (!RouterPathProvider.validate(pathnameData)) return { type: PageDataType.notFound };

	let itemLogicPath: string[];
	let catalog: Catalog;

	const catalogByName = await wm.getCatalogOrFindAtAnyWorkspace(pathnameData.catalogName);
	if (catalogByName) {
		catalog = catalogByName;
		itemLogicPath = pathnameData.itemLogicPath;
	} else {
		const catalogByRepo = await wm.getCatalogOrFindAtAnyWorkspace(pathnameData.repo, (candidate) =>
			isCatalogDataReal(candidate, pathnameData),
		);
		if (catalogByRepo) {
			catalog = catalogByRepo;
			itemLogicPath = pathnameData.repNameItemLogicPath;
		}
	}

	if (!catalog) return { type: PageDataType.home };
	if (await isCatalogDataReal(catalog, pathnameData)) {
		return { type: PageDataType.article, itemLogicPath };
	}
	return { type: PageDataType.notFound };
};

const isCatalogDataReal = async (catalog: Catalog, pathnameData: PathnameData) => {
	const { storage } = catalog.repo;
	if (!storage) return false;
	return isDataReal(isGitSourceType(await storage.getType()), storage, pathnameData);
};

const isDataReal = async (isGit: boolean, storage: Storage, pathnameData: PathnameData) => {
	const sourceName = await storage.getSourceName();

	return (
		sourceName === pathnameData.sourceName &&
		(isGit ? (await (storage as GitStorage).getGroup()) === pathnameData.group : true) &&
		(await storage.getName()) === pathnameData.repo
	);
};

export default getPageDataByPathname;
