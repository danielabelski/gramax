import PublishButton from "@components/Layouts/CatalogLayout/LeftNavigation/PublishButton";
import { BranchButton } from "@components/Layouts/CatalogLayout/RightNavigation/BranchButton";
import { HistoryButton } from "@components/Layouts/CatalogLayout/RightNavigation/HistoryButton";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import useIsOffline from "@ext/errorHandlers/hooks/useIsOffline";
import Sync from "@ext/git/actions/Sync/components/Sync";
import { GlassToolbar, GlassToolbarSeparator } from "@ui-kit/GlassToolbar";
import { VIEWPORT_PADDING } from "../../../ui-kit/lib/floating";

interface MobileNavigationBottomProps {
	closeNavigation: () => void;
}

const MobileNavigationBottom = ({ closeNavigation }: MobileNavigationBottomProps) => {
	const isOffline = useIsOffline();
	const { isNext } = usePlatform();

	return (
		<div
			className="flex justify-center"
			data-qa="qa-status-bar"
			data-testid="mobile-navigation-bottom"
			style={{ paddingInline: VIEWPORT_PADDING, paddingBottom: VIEWPORT_PADDING }}
		>
			<GlassToolbar className="relative w-fit max-w-full overflow-visible pr-1">
				<Sync disable={isOffline} />
				<BranchButton disabled={isOffline} iconOnly onToggle={closeNavigation} />
				{!isNext && (
					<>
						<HistoryButton onToggle={closeNavigation} />
						<GlassToolbarSeparator />
						<PublishButton disable={isOffline} iconOnly onToggle={closeNavigation} />
					</>
				)}
			</GlassToolbar>
		</div>
	);
};

export default MobileNavigationBottom;
