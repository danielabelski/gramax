import { usePanelToggle } from "@ui-kit/FloatingPanel";
import type { RefObject } from "react";
import { PUBLISH_PANEL_ID } from "./constants";

/** Open/close the publish panel from anywhere — a toolbar button, a shortcut, a command. */
export const usePublishPanel = (triggerRef?: RefObject<HTMLButtonElement | null>) => {
	return usePanelToggle(PUBLISH_PANEL_ID, triggerRef);
};
