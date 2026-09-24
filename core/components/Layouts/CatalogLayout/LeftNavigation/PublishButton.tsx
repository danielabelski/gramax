import GitIndexService from "@core-ui/ContextServices/GitIndexService";
import Workspace from "@core-ui/ContextServices/Workspace";
import useWatch from "@core-ui/hooks/useWatch";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { extractCatalogName } from "@core-ui/utils/extractCatalogName";
import { MERGE_REQUEST_PANEL_ID } from "@ext/git/core/GitMergeRequest/constants";
import getMrStatus from "@ext/git/core/GitMergeRequest/logic/getMrStatus";
import { useMergeRequestStore } from "@ext/git/core/GitMergeRequest/logic/store/MergeRequestStore";
import { usePublishPanel } from "@ext/git/core/GitPublish/PublishPanel/usePublishPanel";
import t from "@ext/localization/locale/translate";
import PermissionService from "@ext/security/logic/Permission/components/PermissionService";
import { editCatalogContentPermission } from "@ext/security/logic/Permission/Permissions";
import { Badge } from "@ui-kit/Badge";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PublishButtonProps {
	disable?: boolean;
	disabledReason?: string;
	iconOnly?: boolean;
	onToggle?: () => void;
}

const TOOLTIP_DELAY = 5000;
const TOOLTIP_WITH_CLOSE_ANIMATION_DELAY = TOOLTIP_DELAY + 1000;

const PublishButton = ({ disable, disabledReason, iconOnly, onToggle }: PublishButtonProps) => {
	const workspacePath = Workspace.current()?.path;
	const triggerRef = useRef<HTMLButtonElement>(null);

	const { isOpen: isMergeRequestPanelOpen } = usePanelToggle(MERGE_REQUEST_PANEL_ID);
	const { isOpen: isShow, toggle: togglePublishPanel } = usePublishPanel(triggerRef);

	const { mergeRequest, isDraft } = useMergeRequestStore((state) => ({
		mergeRequest: state.mergeRequest,
		isDraft: state.isDraft,
	}));
	const mergeRequestStatus = useMemo(() => getMrStatus(mergeRequest, isDraft), [mergeRequest, isDraft]);

	const overview = GitIndexService.getOverview();
	const total = overview.added + overview.deleted + overview.modified;

	const initiationChange = useRef(true);
	const mrTooltipHasBeenShown = useRef(false);
	const tooltipTextTimeout = useRef<NodeJS.Timeout | null>(null);
	const [showMrStatusTooltipText, setShowMrStatusTooltipText] = useState(false);
	const { catalogName } = useCatalogPropsStore(
		(state) => ({
			catalogName: extractCatalogName(state?.data?.name),
		}),
		"shallow",
	);
	const canEditCatalogContent = PermissionService.useCheckPermission(
		editCatalogContentPermission,
		workspacePath,
		catalogName,
	);

	useWatch(() => {
		if (!canEditCatalogContent) return;
		if (isMergeRequestPanelOpen) {
			mrTooltipHasBeenShown.current = false;
		} else {
			if (!tooltipTextTimeout.current) return;
			setShowMrStatusTooltipText(false);
			clearTimeout(tooltipTextTimeout.current);
		}
	}, [isMergeRequestPanelOpen]);

	useEffect(() => {
		if (!mergeRequestStatus || !canEditCatalogContent) return;
		if (initiationChange.current) {
			initiationChange.current = false;
			return;
		}

		if (mrTooltipHasBeenShown.current) return;
		mrTooltipHasBeenShown.current = true;

		setShowMrStatusTooltipText(true);
		tooltipTextTimeout.current = setTimeout(
			() => setShowMrStatusTooltipText(false),
			TOOLTIP_WITH_CLOSE_ANIMATION_DELAY,
		);
	}, [mergeRequestStatus, canEditCatalogContent]);

	const handleClick = useCallback(() => {
		togglePublishPanel();
		onToggle?.();
	}, [togglePublishPanel, onToggle]);

	return (
		<GlassToolbarToggleButton
			active={isShow}
			aria-label={t("publish-changes")}
			className="h-8"
			data-qa="qa-publish-trigger"
			data-testid="publish-trigger"
			disabled={disable}
			onClick={handleClick}
			ref={triggerRef}
			title={disabledReason}
			tooltipText={
				disabledReason ||
				(showMrStatusTooltipText && t("git.merge-requests.approval.publish-tooltip")) ||
				(iconOnly ? t("publish-changes") : undefined)
			}
		>
			<GlassToolbarIcon icon="cloud-upload" />
			{!iconOnly && (
				<span className="text-xs font-sans font-medium leading-4">{t("git.publish.to-publish")}</span>
			)}
			{total > 0 && (
				<Badge className="h-5" focus="high" size="sm">
					{total}
				</Badge>
			)}
		</GlassToolbarToggleButton>
	);
};

export default PublishButton;
