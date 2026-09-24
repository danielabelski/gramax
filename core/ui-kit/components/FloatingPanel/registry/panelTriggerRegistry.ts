import type { PanelId } from "../types/FloatingPanelTypes";

const panelTriggers = new Map<PanelId, Set<HTMLElement>>();

export const registerPanelTrigger = (id: PanelId, trigger: HTMLElement) => {
	const triggers = panelTriggers.get(id) ?? new Set<HTMLElement>();
	triggers.add(trigger);
	panelTriggers.set(id, triggers);
};

export const unregisterPanelTrigger = (id: PanelId, trigger: HTMLElement) => {
	const triggers = panelTriggers.get(id);
	if (!triggers) return;
	triggers.delete(trigger);
	if (!triggers.size) panelTriggers.delete(id);
};

export const getPanelTriggers = (id: PanelId): HTMLElement[] => [...(panelTriggers.get(id) ?? [])];
