import type { ReadonlyCatalog } from "@core/FileStructue/Catalog/ReadonlyCatalog";
import type User from "@ext/security/logic/User/User";
import {
	isReadOnlyBranchByPermissions,
	isReadOnlyCatalogByPermissions,
} from "../../../enterpriseCommon/logic/Catalog/IsCatalogReadonly";
import type { GesCloudUser } from "../User/GesCloudUser";

const isReadOnlyCatalogGesCloud = (user: User, catalog: ReadonlyCatalog) => {
	const { permissions } = (user as GesCloudUser).getCatalogSettings();
	return isReadOnlyCatalogByPermissions(catalog, permissions);
};

const isReadOnlyBranchGesCloud = (user: User, catalog: ReadonlyCatalog) => {
	const { permissions, props } = (user as GesCloudUser).getCatalogSettings();
	return isReadOnlyBranchByPermissions(catalog, permissions, props);
};

export const isReadOnlyGesCloud = async (user: User, catalog: ReadonlyCatalog) => {
	if (user.type !== "ges-cloud") throw new Error("User should be from GES Cloud to check edit permissions");

	const [readOnly, readOnlyBranch] = await Promise.all([
		isReadOnlyCatalogGesCloud(user, catalog),
		isReadOnlyBranchGesCloud(user, catalog),
	]);

	return readOnly || readOnlyBranch;
};
