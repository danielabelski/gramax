import WorkspaceService from "@core-ui/ContextServices/Workspace";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import PermissionService from "@ext/security/logic/Permission/components/PermissionService";
import {
	configureCatalogPermission,
	editCatalogContentPermission,
	readPermission,
} from "@ext/security/logic/Permission/Permissions";

export const useCanSeeNavigationBottom = () => {
	const { catalogName, sourceName, resolvedVersion } = useCatalogPropsStore(
		(state) => ({
			catalogName: state.data?.name,
			sourceName: state.data?.sourceName,
			resolvedVersion: state.data?.resolvedVersion,
		}),
		"shallow",
	);
	const workspacePath = WorkspaceService.current()?.path;
	const { isNext, isStatic, isStaticCli } = usePlatform();
	const canConfigureCatalog = PermissionService.useCheckPermission(configureCatalogPermission, workspacePath);
	const canEditContentCatalog = PermissionService.useCheckPermission(
		editCatalogContentPermission,
		workspacePath,
		catalogName,
	);
	const canReadContentCatalog = PermissionService.useCheckPermission(readPermission, workspacePath, catalogName);

	return (
		!!catalogName &&
		!isStatic &&
		!isStaticCli &&
		((isNext && canConfigureCatalog) ||
			(!isNext && (canEditContentCatalog || canReadContentCatalog || !sourceName))) &&
		!resolvedVersion
	);
};
