import type { ClientCatalogProps } from "@core/SitePresenter/SitePresenter";
import type GitStorageData from "@ext/git/core/model/GitStorageData";

export const INIT_NEW_CATALOG_REPOSITORY_ALREADY_EXISTS = "REPOSITORY_ALREADY_EXISTS" as const;

export type PreparedGitStorageData = Pick<GitStorageData, "name" | "group">;

export type InitNewCatalogResult = { success: true; catalogProps: ClientCatalogProps };

export type PrepareNewCatalogResult =
	| { success: true; catalogProps: ClientCatalogProps; data: PreparedGitStorageData }
	| { success: false; errorCode: typeof INIT_NEW_CATALOG_REPOSITORY_ALREADY_EXISTS };
