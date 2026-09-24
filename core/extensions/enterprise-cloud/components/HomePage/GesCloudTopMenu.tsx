import TopMenuSearch from "@components/HomePage/TopMenu/Components/TopMenuSearch";
import TopMenuSwitchUiLanguageButton from "@components/HomePage/TopMenu/Components/TopMenuSwitchUiLanguageButton";
import TopMenuThemeToggle from "@components/HomePage/TopMenu/Components/TopMenuThemeToggle";
import TopMenuWrapper, {
	TopMenuLeftSide,
	TopMenuLeftSideActions,
	TopMenuRightSide,
} from "@components/HomePage/TopMenu/Components/TopMenuWrapper";
import type { Section } from "@core/SitePresenter/SitePresenter";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import WorkspaceService from "@core-ui/ContextServices/Workspace";
import AddCatalogMenu from "@ext/catalog/actions/AddCatalogMenu";
import useSignOut from "@ext/enterprise/components/SingInOut/hooks/useSignOut";
import { GesCloudSwitchOrganization } from "@ext/enterprise-cloud/components/GesCloudOrganizationSwitch";
import { GesCloudSignInOut } from "@ext/enterprise-cloud/components/SignInOut/GesCloudSignInOut";
import SwitchWorkspace from "@ext/workspace/components/SwitchWorkspace";
import { HomeLogo } from "../../../../../apps/web/src/components/Atoms/HomeLogo";
import PermissionService from "../../../security/logic/Permission/components/PermissionService";
import { editCatalogPermission } from "../../../security/logic/Permission/Permissions";

export const GesCloudTopMenu = ({ section }: { section?: Section }) => {
	const hasWorkspace = WorkspaceService.hasActive();
	const { isLogged } = useSignOut();
	const { enabled } = PageDataContextService.value.conf.enterpriseCloud;
	const isWorkWithCatalogAllowed = hasWorkspace && (isLogged || !enabled);

	const hasEditCatalogPermission = PermissionService.useCheckPermission(
		editCatalogPermission,
		WorkspaceService.current().path,
	);
	const canEditCatalogContent = hasEditCatalogPermission || !enabled;

	return (
		<TopMenuWrapper>
			<TopMenuLeftSide>
				<HomeLogo />
				<TopMenuLeftSideActions>
					{hasWorkspace && !enabled && <SwitchWorkspace />}
					{isLogged && enabled && <GesCloudSwitchOrganization />}
					{isWorkWithCatalogAllowed && (
						<AddCatalogMenu
							canCreateCatalog={canEditCatalogContent}
							canImportCatalog={canEditCatalogContent}
						/>
					)}
				</TopMenuLeftSideActions>
			</TopMenuLeftSide>
			<TopMenuRightSide>
				{isWorkWithCatalogAllowed && <TopMenuSearch section={section} />}
				<TopMenuSwitchUiLanguageButton />
				<TopMenuThemeToggle />
				<GesCloudSignInOut />
			</TopMenuRightSide>
		</TopMenuWrapper>
	);
};
