import useIsOffline from "@ext/errorHandlers/hooks/useIsOffline";
import DiffExtendedModeToggle from "@ext/git/core/Diff/components/Changes/DiffExtendedModeToggle";
import t from "@ext/localization/locale/translate";
import { FloatingPanel } from "@ui-kit/FloatingPanel";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { PUBLISH_PANEL_ID } from "./constants";
import { PublishPanelContent } from "./PublishPanelContent";

export const PublishPanel = () => {
	const isOffline = useIsOffline();

	return (
		<FloatingPanel
			headerActions={<DiffExtendedModeToggle />}
			icon="cloud-upload"
			id={PUBLISH_PANEL_ID}
			interactionDisabled={isOffline}
			title={t("git.publish.name")}
		>
			<ComponentVariantProvider variant="glass">
				<div className="flex min-h-0 flex-1 flex-col">
					<PublishPanelContent />
				</div>
			</ComponentVariantProvider>
		</FloatingPanel>
	);
};
