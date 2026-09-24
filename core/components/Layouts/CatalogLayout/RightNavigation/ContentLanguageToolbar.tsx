import SwitchContentLanguage from "@ext/localization/actions/SwitchContentLanguage";
import { GlassToolbar } from "@ui-kit/GlassToolbar";
import { CollapsedRightNavigation } from "./CollapsedRightNavigation";

export const ContentLanguageToolbar = () => {
	return (
		<GlassToolbar>
			<SwitchContentLanguage triggerVariant="glass" />
			<CollapsedRightNavigation />
		</GlassToolbar>
	);
};
