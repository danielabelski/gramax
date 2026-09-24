import { MAX_PANEL_Z_INDEX } from "../constants";
import type { PanelId, PanelState } from "../types/FloatingPanelTypes";

export const orderPanelsByZIndex = (
	panels: Record<PanelId, PanelState>,
	frontPanelId?: PanelId,
): Record<PanelId, PanelState> => {
	if (frontPanelId && !panels[frontPanelId]) return panels;

	const orderedPanels = Object.entries(panels).sort(([, first], [, second]) => first.zIndex - second.zIndex);
	if (frontPanelId) {
		const frontPanelIndex = orderedPanels.findIndex(([id]) => id === frontPanelId);
		const [frontPanel] = orderedPanels.splice(frontPanelIndex, 1);
		orderedPanels.push(frontPanel);
	}

	const firstZIndex = MAX_PANEL_Z_INDEX - orderedPanels.length + 1;
	const zIndexes = new Map(orderedPanels.map(([id], index) => [id, firstZIndex + index]));
	return Object.fromEntries(
		Object.entries(panels).map(([id, panel]) => [id, { ...panel, zIndex: zIndexes.get(id) ?? panel.zIndex }]),
	);
};
