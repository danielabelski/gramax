import WorkspaceService from "@core-ui/ContextServices/Workspace";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { extractCatalogName } from "@core-ui/utils/extractCatalogName";
import useIsOffline from "@ext/errorHandlers/hooks/useIsOffline";
import t from "@ext/localization/locale/translate";
import PermissionService from "@ext/security/logic/Permission/components/PermissionService";
import { editCatalogContentPermission, editCatalogPermission } from "@ext/security/logic/Permission/Permissions";
import { FloatingPanel } from "@ui-kit/FloatingPanel";
import { FloatingIconButton } from "@ui-kit/FloatingPanel/components/FloatingIconButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useState } from "react";
import { BranchPanelContent } from "./BranchPanelContent";
import { BRANCH_PANEL_ID } from "./constants";

export const BranchPanel = () => {
	const { isNext } = usePlatform();
	const workspacePath = WorkspaceService.current()?.path;
	const catalogName = useCatalogPropsStore((state) => extractCatalogName(state.data?.name));
	const canEditCatalog = PermissionService.useCheckPermission(editCatalogPermission, workspacePath, catalogName);
	const canEditCatalogContent = PermissionService.useCheckPermission(
		editCatalogContentPermission,
		workspacePath,
		catalogName,
	);
	const [isCreating, setIsCreating] = useState(false);
	const isOffline = useIsOffline();

	const allowCreate = !isNext && canEditCatalog;
	const allowActions = !isNext && canEditCatalogContent;

	return (
		<FloatingPanel
			headerActions={
				allowCreate && (
					<Tooltip>
						<TooltipTrigger asChild>
							<FloatingIconButton
								aria-label={t("add-new-branch")}
								data-testid="create-branch"
								icon="plus"
								onClick={() => setIsCreating(!isCreating)}
								size="md"
							/>
						</TooltipTrigger>
						<TooltipContent>{t("add-new-branch")}</TooltipContent>
					</Tooltip>
				)
			}
			icon="git-branch"
			id={BRANCH_PANEL_ID}
			interactionDisabled={isOffline}
			title={t("branches")}
		>
			<BranchPanelContent
				allowActions={allowActions}
				allowCreate={allowCreate}
				catalogName={catalogName}
				isCreating={isCreating}
				setIsCreating={setIsCreating}
			/>
		</FloatingPanel>
	);
};
