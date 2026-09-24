import { MIN_VISIBLE } from "../constants";
import type { Position, Size, Viewport } from "../types/FloatingPanelTypes";

export const clampPosition = (
	position: Position,
	panelSize: Size,
	viewport: Viewport = { width: window.innerWidth, height: window.innerHeight },
): Position => {
	const minVisible = Math.min(MIN_VISIBLE, panelSize.width);

	const x = Math.min(Math.max(position.x, 0), viewport.width - minVisible);
	const y = Math.min(Math.max(position.y, 0), Math.max(viewport.height - panelSize.height, 0));

	return { x, y };
};
