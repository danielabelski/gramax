import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import type { PanelDefinition, PanelId } from "../types/FloatingPanelTypes";

export const registerPanel = (definition: PanelDefinition) =>
	useFloatingPanelStore.getState().registerPanel(definition);

export const unregisterPanel = (id: PanelId) => useFloatingPanelStore.getState().unregisterPanel(id);
