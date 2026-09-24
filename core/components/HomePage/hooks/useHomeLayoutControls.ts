import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import WorkspaceService from "@core-ui/ContextServices/Workspace";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useIsEnterprise } from "@ext/enterprise/utils/useIsEnterprise";
import { useGesCloudOrganizationStore } from "@ext/enterprise-cloud/ui-logic/stores/GesCloudOrganizationStore/GesCloudOrganizationStore.provider";
import PermissionService from "@ext/security/logic/Permission/components/PermissionService";
import { configureWorkspacePermission, editCatalogPermission } from "@ext/security/logic/Permission/Permissions";
import { useEffect } from "react";
import { useHomepageLayoutStore } from "../store/homepageLayoutStore";
import type { HomeLayoutEditScope } from "../utils/homeLayoutTypes";

export const useHomeLayoutControls = () => {
	const activeView = useHomepageLayoutStore((state) => state.activeView);
	const setActiveView = useHomepageLayoutStore((state) => state.setActiveView);
	const beginEdit = useHomepageLayoutStore((state) => state.beginEdit);
	const editScope = useHomepageLayoutStore((state) => state.editScope);
	const isMainPage = useHomepageLayoutStore((state) => state.isMainPage);
	const isEditing = editScope !== null;
	const { isDocportal, isStatic } = usePlatform();
	const workspacePath = WorkspaceService.current()?.path;
	const canConfigureWorkspace = PermissionService.useCheckPermission(configureWorkspacePermission, workspacePath);
	const canEditAnyCatalog = PermissionService.useCheckAnyCatalogPermission(editCatalogPermission);
	const isCloud = Boolean(PageDataContextService.value.conf.enterpriseCloud?.url);
	const currentCloudOrganization = useGesCloudOrganizationStore((state) =>
		state.organizations.find((organization) => organization.current),
	);
	const isGesWorkspace = useIsEnterprise();
	const hasIdentity = !isGesWorkspace || PageDataContextService.value.isLogged;
	const canEditSharedView = isCloud
		? Boolean(currentCloudOrganization?.canEdit)
		: hasIdentity && canConfigureWorkspace;
	const isManagedWorkspace = isCloud || isGesWorkspace;
	const canEditPersonalView = !isManagedWorkspace || canEditSharedView || canEditAnyCatalog;
	const canShowSharedView = isManagedWorkspace && (canEditSharedView || canEditPersonalView);
	const editScopeTarget: HomeLayoutEditScope = canShowSharedView ? activeView : "personal";
	const editDisabledByPermission = editScopeTarget === "global" && !canEditSharedView;
	const editDisabledByDuplicateCatalog = useHomepageLayoutStore(
		(state) => state.duplicateCatalogByScope[editScopeTarget],
	);
	const hasCatalogs = useHomepageLayoutStore(
		(state) => state.hasCatalogsByScope.global || state.hasCatalogsByScope.personal,
	);

	useEffect(() => {
		if (!canShowSharedView && activeView !== "personal" && !isEditing) setActiveView("personal");
	}, [activeView, canShowSharedView, isEditing, setActiveView]);

	return {
		activeView,
		beginEdit,
		canShowSharedView,
		editDisabledByDuplicateCatalog,
		editDisabledByPermission,
		editScopeTarget,
		isEditing,
		isVisible:
			!isDocportal &&
			!isStatic &&
			isMainPage &&
			WorkspaceService.hasActive() &&
			!PageDataContextService.value.conf.isReadOnly &&
			hasCatalogs &&
			(canEditPersonalView || canEditSharedView),
		setActiveView,
	};
};
