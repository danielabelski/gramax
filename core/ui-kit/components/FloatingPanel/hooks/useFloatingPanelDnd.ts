import type { DragEndEvent, DragStartEvent, Modifiers } from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import type { PanelId } from "../types/FloatingPanelTypes";
import { clampPosition } from "../utils/clampPosition";
import { getEdgeDropSide } from "../utils/getEdgeDropSide";
import { restrictFloatingPanelToViewport } from "../utils/restrictFloatingPanelToViewport";

const modifiers: Modifiers = [restrictFloatingPanelToViewport];

export const useFloatingPanelDnd = () => {
	const panels = useFloatingPanelStore((state) => state.panels);
	const setPosition = useFloatingPanelStore((state) => state.setPosition);
	const bringToFront = useFloatingPanelStore((state) => state.bringToFront);
	const dockPanel = useFloatingPanelStore((state) => state.dockPanel);
	const undockPanel = useFloatingPanelStore((state) => state.undockPanel);
	const canDock = useFloatingPanelStore((state) => state.isRightDockZoneAvailable === true);
	const rightDockZoneBounds = useFloatingPanelStore((state) => state.rightDockZoneBounds);

	const handleDragStart = (event: DragStartEvent) => {
		bringToFront(event.active.id as PanelId);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const id = event.active.id as PanelId;
		const panel = panels[id];
		const rect = event.active.rect.current.translated;
		const initialGrabPoint = getEventCoordinates(event.activatorEvent);
		const dropSide = initialGrabPoint
			? getEdgeDropSide(
					{ x: initialGrabPoint.x + event.delta.x, y: initialGrabPoint.y + event.delta.y },
					{ width: window.innerWidth, height: window.innerHeight },
					rightDockZoneBounds,
				)
			: null;

		if (canDock && dropSide) {
			dockPanel(id, dropSide);
			return;
		}

		if (panel.dockedSide) {
			if (rect) undockPanel(id, clampPosition({ x: rect.left, y: rect.top }, panel.size));
			return;
		}

		const position = panel.position;
		if (!position) return;
		setPosition(id, clampPosition({ x: position.x + event.delta.x, y: position.y + event.delta.y }, panel.size));
	};

	return { handleDragStart, handleDragEnd, modifiers };
};
