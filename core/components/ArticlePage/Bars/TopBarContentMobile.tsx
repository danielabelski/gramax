import t from "@ext/localization/locale/translate";
import { GlassToolbar, GlassToolbarButton, GlassToolbarIcon } from "@ui-kit/GlassToolbar";

interface TopBarContentMobileProps {
	toggleSidebar?: () => void;
}

export const TopBarContentMobile = ({ toggleSidebar }: TopBarContentMobileProps) => (
	<GlassToolbar variant="single">
		{toggleSidebar && (
			<GlassToolbarButton aria-label={t("left-navigation.expand")} onClick={toggleSidebar}>
				<GlassToolbarIcon icon="panel-left" />
			</GlassToolbarButton>
		)}
	</GlassToolbar>
);

export default TopBarContentMobile;
