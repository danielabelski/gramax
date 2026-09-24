import type { Position, Size, Viewport } from "../types/FloatingPanelTypes";

export const clampPositionIntoViewport = (
	position: Position,
	size: Size,
	viewport: Viewport = { width: window.innerWidth, height: window.innerHeight },
): Position => {
	const maxX = Math.max(viewport.width - size.width, 0);
	const maxY = Math.max(viewport.height - size.height, 0);

	return {
		x: Math.min(Math.max(position.x, 0), maxX),
		y: Math.min(Math.max(position.y, 0), maxY),
	};
};
