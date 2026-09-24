import type { NumberSize, ResizeDirection } from "re-resizable";
import type { Position, Size } from "../types/FloatingPanelTypes";
import { clampPosition } from "./clampPosition";

type GetResizedPanelPositionOptions = {
	start: Position | null;
	direction: ResizeDirection;
	delta: NumberSize;
	panelSize: Size;
};

export const getResizedPanelPosition = ({
	start,
	direction,
	delta,
	panelSize,
}: GetResizedPanelPositionOptions): Position | null => {
	if (!start) return null;

	const normalizedDirection = direction.toLowerCase();
	const position = {
		x: normalizedDirection.includes("left") ? start.x - delta.width : start.x,
		y: normalizedDirection.includes("top") ? start.y - delta.height : start.y,
	};

	return clampPosition(position, {
		width: panelSize.width + delta.width,
		height: panelSize.height + delta.height,
	});
};
