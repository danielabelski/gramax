import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { BRANCH_PANEL_ID } from "@ext/git/actions/Branch/BranchPanel/constants";
import t from "@ext/localization/locale/translate";
import { useIsStorageConnected } from "@ext/storage/logic/utils/useStorage";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import {
	GlassToolbarIcon,
	GlassToolbarSeparator,
	GlassToolbarText,
	GlassToolbarToggleButton,
} from "@ui-kit/GlassToolbar";
import { Loader } from "@ui-kit/Loader";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { useCallback, useRef } from "react";
import { useIsRightNavigationCollapsed } from "./catalogViewportWidthStore";
import { EXPANDED_RIGHT_NAVIGATION_CONTENT_CLASS_NAME } from "./constants";
import { useCurrentBranch } from "./useCurrentBranch";

interface BranchButtonProps {
	collapseWithRightNavigation?: boolean;
	disabled?: boolean;
	iconOnly?: boolean;
	onToggle?: () => void;
}

export const BranchButton = ({ collapseWithRightNavigation, disabled, iconOnly, onToggle }: BranchButtonProps) => {
	const { isNext } = usePlatform();
	const isCollapsed = useIsRightNavigationCollapsed();
	const apiUrlCreator = ApiUrlCreatorService.value;
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { isOpen, toggle } = usePanelToggle(BRANCH_PANEL_ID, triggerRef);
	const isStorageConnected = useIsStorageConnected();
	const { repositoryError, resolvedView } = useCatalogPropsStore(
		(state) => ({
			repositoryError: state.data?.repositoryError,
			resolvedView: state.data?.resolvedView,
		}),
		"shallow",
	);
	const canShowBranch = isStorageConnected && !repositoryError && !resolvedView;
	const canLoadBranch = canShowBranch && !disabled;
	const { branch, hasError } = useCurrentBranch(canLoadBranch, apiUrlCreator);

	const branchLabel = branch?.name ? `${t("git.branch.current")}: ${branch.name}` : t("git.branch.current");
	const isNameHidden = iconOnly || (collapseWithRightNavigation && isCollapsed);
	const branchTooltip = isNameHidden ? branchLabel : undefined;

	const handleClick = useCallback(() => {
		toggle();
		onToggle?.();
	}, [toggle, onToggle]);

	if (!canShowBranch || hasError) return null;

	return (
		<>
			<GlassToolbarToggleButton
				active={isOpen}
				aria-label={t("git.branch.current")}
				className="max-w-56"
				data-testid="branch-trigger"
				disabled={disabled}
				onClick={handleClick}
				ref={triggerRef}
				tooltipText={branchTooltip}
			>
				<GlassToolbarIcon className="shrink-0" icon="git-branch" />
				{!iconOnly && (
					<span
						className={
							collapseWithRightNavigation ? EXPANDED_RIGHT_NAVIGATION_CONTENT_CLASS_NAME : "contents"
						}
					>
						{branch?.name ? (
							<GlassToolbarText className="min-w-0 text-xs font-medium">
								<TextOverflowTooltip className="align-middle">{branch.name}</TextOverflowTooltip>
							</GlassToolbarText>
						) : (
							<Loader className="p-0" size="sm" />
						)}
						<GlassToolbarIcon className="size-3" icon="chevron-down" />
					</span>
				)}
			</GlassToolbarToggleButton>
			{!isNext && <GlassToolbarSeparator />}
		</>
	);
};
