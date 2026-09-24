import { useCallback, useRef } from "react";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import type { PanelId, PanelSlot } from "../types/FloatingPanelTypes";

export const usePanelSlotRef = (id: PanelId, slot: PanelSlot) => {
	const setPanelSlot = useFloatingPanelStore((state) => state.setPanelSlot);
	const nodeRef = useRef<HTMLDivElement>(null);

	return useCallback(
		(element: HTMLDivElement | null) => {
			const previous = nodeRef.current;
			nodeRef.current = element;

			if (element) {
				setPanelSlot(id, slot, element);
				return;
			}

			if (useFloatingPanelStore.getState().slots[id]?.[slot] === previous) setPanelSlot(id, slot, null);
		},
		[id, slot, setPanelSlot],
	);
};
