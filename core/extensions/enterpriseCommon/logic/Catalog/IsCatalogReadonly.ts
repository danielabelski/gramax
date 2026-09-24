import type { ReadonlyCatalog } from "@core/FileStructue/Catalog/ReadonlyCatalog";
import { editCatalogContentPermission, editCatalogPermission } from "@ext/security/logic/Permission/Permissions";
import type IPermissionMap from "../../../security/logic/PermissionMap/IPermissionMap";
import type { UserCatalogPropsSet } from "../user/UserCatalogProps";

export const isReadOnlyCatalogByPermissions = async (catalog: ReadonlyCatalog, catalogPermissions: IPermissionMap) => {
	if (!(await catalog?.repo?.gvc?.isInit())) return false;
	const containsEditPermission = catalogPermissions.enough(catalog.name, editCatalogContentPermission);
	return !containsEditPermission;
};

export const isReadOnlyBranchByPermissions = async (
	catalog: ReadonlyCatalog,
	catalogPermissions: IPermissionMap,
	catalogProps: UserCatalogPropsSet,
) => {
	const allowedBranches = catalogProps?.[catalog?.name]?.branches ?? [];

	try {
		const branch = await catalog?.repo?.gvc?.getCurrentBranch?.();
		if (!branch) return false;
		const branchStr = branch.toString();
		if (catalogPermissions.enough(catalog.name, editCatalogPermission)) return false;
		return !allowedBranches.includes(branchStr);
	} catch {
		return false;
	}
};
