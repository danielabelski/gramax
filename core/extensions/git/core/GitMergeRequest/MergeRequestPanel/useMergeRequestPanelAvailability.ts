import { MERGE_REQUEST_PANEL_ID } from "@ext/git/core/GitMergeRequest/constants";
import { useFloatingPanelStore } from "@ui-kit/FloatingPanel";
import { useLayoutEffect } from "react";

export const useMergeRequestPanelAvailability = (hasMergeRequest: boolean) => {
	const isOpen = useFloatingPanelStore((state) => state.panels[MERGE_REQUEST_PANEL_ID]?.isOpen ?? false);
	const setIsOpen = useFloatingPanelStore((state) => state.setIsOpen);

	useLayoutEffect(() => {
		if (isOpen && !hasMergeRequest) setIsOpen(MERGE_REQUEST_PANEL_ID, false);
	}, [hasMergeRequest, isOpen, setIsOpen]);
};
