import { useDndMonitor } from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import { useState } from "react";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import type { SideZoneSide } from "../types/FloatingPanelTypes";
import { getEdgeDropSide } from "../utils/getEdgeDropSide";

export const useActiveDropSide = (): SideZoneSide | null => {
	const [dropSide, setDropSide] = useState<SideZoneSide | null>(null);
	const canDock = useFloatingPanelStore((state) => state.isRightDockZoneAvailable === true);
	const rightDockZoneBounds = useFloatingPanelStore((state) => state.rightDockZoneBounds);

	useDndMonitor({
		onDragMove: ({ activatorEvent, delta }) => {
			const initialGrabPoint = getEventCoordinates(activatorEvent);
			setDropSide(
				canDock && initialGrabPoint
					? getEdgeDropSide(
							{ x: initialGrabPoint.x + delta.x, y: initialGrabPoint.y + delta.y },
							{ width: window.innerWidth, height: window.innerHeight },
							rightDockZoneBounds,
						)
					: null,
			);
		},
		onDragEnd: () => setDropSide(null),
		onDragCancel: () => setDropSide(null),
	});

	return dropSide;
};
