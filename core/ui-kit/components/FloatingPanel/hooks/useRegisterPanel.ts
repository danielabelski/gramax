import type { IconCode } from "@ui-kit/Icon";
import { useEffect } from "react";
import { registerPanel, unregisterPanel } from "../registry/panelRegistry";
import type { PanelId } from "../types/FloatingPanelTypes";

/** Registers a panel for as long as the component is mounted. Panel state survives unmount and is restored on remount. */
export const useRegisterPanel = (id: PanelId, title: string, icon?: IconCode, interactionDisabled?: boolean) => {
	useEffect(() => {
		registerPanel({ id, title, icon, interactionDisabled });
		return () => unregisterPanel(id);
	}, [id, title, icon, interactionDisabled]);
};
