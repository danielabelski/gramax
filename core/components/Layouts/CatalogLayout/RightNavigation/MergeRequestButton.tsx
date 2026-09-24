import WorkspaceService from "@core-ui/ContextServices/Workspace";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { cn } from "@core-ui/utils/cn";
import { extractCatalogName } from "@core-ui/utils/extractCatalogName";
import { MERGE_REQUEST_PANEL_ID } from "@ext/git/core/GitMergeRequest/constants";
import getMrStatus from "@ext/git/core/GitMergeRequest/logic/getMrStatus";
import { useMergeRequestStore } from "@ext/git/core/GitMergeRequest/logic/store/MergeRequestStore";
import t from "@ext/localization/locale/translate";
import PermissionService from "@ext/security/logic/Permission/components/PermissionService";
import { editCatalogContentPermission } from "@ext/security/logic/Permission/Permissions";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import { GlassToolbar, GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { Indicator } from "@ui-kit/Indicator";
import { useRef } from "react";

const STATUS_INDICATOR_CLASS = {
	draft: "bg-status-neutral",
	"in-progress": "bg-status-warning",
	approved: "bg-status-success",
} as const;

export const MergeRequestButton = () => {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const catalogName = useCatalogPropsStore((state) => extractCatalogName(state.data?.name));
	const canEditCatalog = PermissionService.useCheckPermission(
		editCatalogContentPermission,
		WorkspaceService.current()?.path,
		catalogName,
	);
	const { isOpen, toggle } = usePanelToggle(MERGE_REQUEST_PANEL_ID, triggerRef);
	const { mergeRequest, isDraft } = useMergeRequestStore((state) => ({
		mergeRequest: state.mergeRequest,
		isDraft: state.isDraft,
	}));

	if (!mergeRequest || !canEditCatalog) return null;

	const status = getMrStatus(mergeRequest, isDraft);

	return (
		<GlassToolbar className="overflow-visible relative" variant="single">
			<GlassToolbarToggleButton
				active={isOpen}
				onClick={toggle}
				ref={triggerRef}
				tooltipText={t("git.merge-requests.name")}
			>
				<GlassToolbarIcon icon="git-pull-request-arrow" />
			</GlassToolbarToggleButton>
			<Indicator
				aria-hidden
				className={cn("absolute right-0 top-0 size-2.5 rounded-full", STATUS_INDICATOR_CLASS[status])}
			/>
		</GlassToolbar>
	);
};
