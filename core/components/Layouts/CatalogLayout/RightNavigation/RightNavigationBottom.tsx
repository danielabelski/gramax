import { usePlatform } from "@core-ui/hooks/usePlatform";
import useIsOffline from "@ext/errorHandlers/hooks/useIsOffline";
import { useIsStorageConnected } from "@ext/storage/logic/utils/useStorage";
import { GlassToolbar } from "@ui-kit/GlassToolbar";
import { useSidebar } from "@ui-kit/Sidebar";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";
import { useCanSeeNavigationBottom } from "../useCanSeeNavigationBottom";
import { BranchButton } from "./BranchButton";
import { HistoryButton } from "./HistoryButton";
import { MergeRequestButton } from "./MergeRequestButton";

export const RightNavigationBottom = () => {
	const { isNext } = usePlatform();
	const { isMobile } = useSidebar();
	const canSeeNavigationBottom = useCanSeeNavigationBottom();
	const isOffline = useIsOffline();
	const isStorageConnected = useIsStorageConnected();

	if (isMobile || !canSeeNavigationBottom) return null;

	return (
		<div
			className="pointer-events-auto absolute flex items-center gap-2"
			style={{ bottom: VIEWPORT_PADDING, right: VIEWPORT_PADDING }}
		>
			<MergeRequestButton />
			{isStorageConnected && (
				<GlassToolbar className="overflow-visible relative" variant={isNext ? "single" : "default"}>
					<BranchButton collapseWithRightNavigation disabled={isOffline} />
					<HistoryButton />
				</GlassToolbar>
			)}
		</div>
	);
};
