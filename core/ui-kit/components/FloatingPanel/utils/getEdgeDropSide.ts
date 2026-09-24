import { SIDE_ZONE_DROP_THRESHOLD } from "@ui-kit/FloatingPanel/constants";
import type { DockZoneBounds, Position, SideZoneSide, Viewport } from "../types/FloatingPanelTypes";

const isPointInsideBounds = ({ x, y }: Position, { left, right, top, bottom }: DockZoneBounds) =>
	x >= left && x <= right && y >= top && y <= bottom;

export const getEdgeDropSide = (
	grabPoint: Position,
	viewport: Viewport,
	dockZoneBounds: DockZoneBounds | null,
): SideZoneSide | null => {
	const targetBounds = dockZoneBounds ?? {
		left: viewport.width - SIDE_ZONE_DROP_THRESHOLD,
		right: viewport.width,
		top: 0,
		bottom: viewport.height,
	};

	if (isPointInsideBounds(grabPoint, targetBounds)) return "right";
	return null;
};
