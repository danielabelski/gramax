import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import t from "@ext/localization/locale/translate";
import { ReviewList } from "@ext/review/components/ReviewList";
import { useIsStorageConnected } from "@ext/storage/logic/utils/useStorage";
import { FloatingPanel } from "@ui-kit/FloatingPanel";
import { useRef } from "react";
import { REVIEW_PANEL_ID } from "./constants";
import { ReviewPanelActions } from "./ReviewPanelActions";

export const ReviewPanel = () => {
	const panelRef = useRef<HTMLDivElement>(null);
	const pageDataContext = PageDataContext.value;
	const isStorageConnected = useIsStorageConnected();
	const isAvailable = Boolean(pageDataContext.user.info && isStorageConnected && !pageDataContext.conf.isReadOnly);

	if (!isAvailable) return null;

	return (
		<FloatingPanel
			headerActions={<ReviewPanelActions />}
			icon="message-square-quote"
			id={REVIEW_PANEL_ID}
			title={t("editor.modes.type-filter.comments")}
		>
			<ReviewList panelRef={panelRef} />
		</FloatingPanel>
	);
};
