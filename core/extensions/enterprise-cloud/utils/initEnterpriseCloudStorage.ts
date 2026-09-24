import { GesCloudApi } from "@ext/enterprise-cloud/GesCloudApi";
import DefaultError from "@ext/errorHandlers/logic/DefaultError";
import type GitStorageData from "@ext/git/core/model/GitStorageData";
import t from "@ext/localization/locale/translate";
import SourceType from "@ext/storage/logic/SourceDataProvider/model/SourceType";
import type StorageData from "@ext/storage/models/StorageData";
import type AuthManager from "../../security/logic/AuthManager";
import { ClientGesCloudAuthManager } from "../logic/ClientGesCloudAuthManager";

const EnterpriseSources: SourceType[] = [SourceType.gitLab];

export const initEnterpriseCloudStorage = async (
	gesCloudUrl: string | undefined,
	storageData: StorageData,
	am: AuthManager,
) => {
	if (!gesCloudUrl) return;
	if (!EnterpriseSources.includes(storageData.source.sourceType)) return;

	const gitStorageData = storageData as GitStorageData;
	if (!gesCloudUrl.includes(gitStorageData.source.domain)) return;

	const res = await new GesCloudApi(gesCloudUrl).initStorage(`${gitStorageData.group}/${gitStorageData.name}`);
	if (!res) throw new DefaultError(t("enterprise.init-repo.error"));

	if (am instanceof ClientGesCloudAuthManager) await am.updateUserPermissions();
	else throw new DefaultError(t("enterprise.init-repo.error"));
};
