import { usePlatform } from "@core-ui/hooks/usePlatform";
import useIsOffline from "@ext/errorHandlers/hooks/useIsOffline";
import { RevisionsCompare } from "@ext/git/actions/Revisions/components/RevisionsTab/Compare/RevisionsCompare";
import { RevisionCatalogFilters } from "@ext/git/actions/Revisions/components/RevisionsTab/Filters/RevisionCatalogFilters";
import { useRevisionsCatalogTab } from "@ext/git/actions/Revisions/logic/hooks/useRevisionsCatalogTab";
import t from "@ext/localization/locale/translate";
import { FloatingPanel, usePanelToggle } from "@ui-kit/FloatingPanel";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { useRef } from "react";
import { HISTORY_PANEL_ID } from "./constants";
import { HistoryPanelContent } from "./HistoryPanelContent";

const AvailableHistoryPanel = () => {
	const isOffline = useIsOffline();
	const anchorRef = useRef<HTMLDivElement>(null);
	const { isOpen, open, close } = usePanelToggle(HISTORY_PANEL_ID);
	const revisionsState = useRevisionsCatalogTab({
		show: isOpen,
		setShow: (show) => (show ? open() : close()),
	});

	return (
		<FloatingPanel
			headerActions={
				<ComponentVariantProvider variant="glass">
					<RevisionsCompare anchorRef={anchorRef} panelOpen={isOpen} />
					<RevisionCatalogFilters panelOpen={isOpen} />
				</ComponentVariantProvider>
			}
			icon="history"
			id={HISTORY_PANEL_ID}
			interactionDisabled={isOffline}
			title={t("git.history.name")}
		>
			<HistoryPanelContent {...revisionsState} anchorRef={anchorRef} />
		</FloatingPanel>
	);
};

export const HistoryPanel = () => {
	const { isNext } = usePlatform();
	if (isNext) return null;
	return <AvailableHistoryPanel />;
};
