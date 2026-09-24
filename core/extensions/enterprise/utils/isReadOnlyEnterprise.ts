import { getExecutingEnvironment } from "@app/resolveModule/env";
import type { ReadonlyCatalog } from "@core/FileStructue/Catalog/ReadonlyCatalog";
import type EnterpriseUser from "@ext/enterprise/EnterpriseUser";
import type User from "@ext/security/logic/User/User";
import {
	isReadOnlyBranchByPermissions,
	isReadOnlyCatalogByPermissions,
} from "../../enterpriseCommon/logic/Catalog/IsCatalogReadonly";

const isReadOnlyCatalog = (user: User, catalog: ReadonlyCatalog) => {
	const enterpriseInfo = (user as EnterpriseUser).getEnterpriseInfo();
	return isReadOnlyCatalogByPermissions(catalog, enterpriseInfo.catalogPermission);
};

const isReadOnlyBranch = (user: User, catalog: ReadonlyCatalog) => {
	const enterpriseInfo = (user as EnterpriseUser).getEnterpriseInfo();
	const props = enterpriseInfo.catalogsProps;
	return isReadOnlyBranchByPermissions(catalog, enterpriseInfo.catalogPermission, props);
};

const isReadOnlyEnterprise = async (user: User, catalog: ReadonlyCatalog) => {
	if (getExecutingEnvironment() === "next") return true;
	if (user.type !== "enterprise") return false;

	const readOnly = await isReadOnlyCatalog(user, catalog);
	const readOnlyBranch = await isReadOnlyBranch(user, catalog);

	return readOnly || readOnlyBranch;
};

export default isReadOnlyEnterprise;
