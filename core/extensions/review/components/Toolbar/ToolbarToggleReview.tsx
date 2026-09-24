import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import t from "@ext/localization/locale/translate";
import { REVIEW_PANEL_ID } from "@ext/review/components/ReviewPanel/constants";
import { useIsStorageConnected } from "@ext/storage/logic/utils/useStorage";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { useRef } from "react";

export const ToolbarToggleReview = () => {
	const pageDataContext = PageDataContext.value;
	const isStorageConnected = useIsStorageConnected();
	const isCommentsDisabled = !pageDataContext.user.info || !isStorageConnected;
	const isReadOnly = pageDataContext.conf.isReadOnly;
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { isOpen, toggle } = usePanelToggle(REVIEW_PANEL_ID, triggerRef);

	if (isCommentsDisabled) return null;

	return (
		<GlassToolbarToggleButton
			active={isOpen}
			disabled={isReadOnly}
			onClick={toggle}
			ref={triggerRef}
			tooltipText={t("editor.modes.comments")}
		>
			<GlassToolbarIcon icon={"comment"} />
		</GlassToolbarToggleButton>
	);
};
