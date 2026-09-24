import { HEADER_HEIGHT } from "../constants";
import type { PanelAnimationOrigin, Position, Size, Viewport } from "../types/FloatingPanelTypes";

type TriggerRect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

type GetPanelPositionByTriggerOptions = {
	trigger: TriggerRect;
	panelSize: Size;
	viewport: Viewport;
	gap: number;
};

type PanelTriggerPlacement = {
	position: Position;
	animationOrigin: PanelAnimationOrigin;
};

type Placement =
	| "right-start"
	| "right-end"
	| "left-start"
	| "left-end"
	| "bottom-start"
	| "bottom-end"
	| "top-start"
	| "top-end";

const placements: Placement[] = [
	"top-start",
	"top-end",
	"bottom-start",
	"bottom-end",
	"right-start",
	"right-end",
	"left-start",
	"left-end",
];

const getPosition = (placement: Placement, trigger: TriggerRect, panelSize: Size, gap: number): Position => {
	switch (placement) {
		case "right-start":
			return { x: trigger.right + gap, y: trigger.top };
		case "right-end":
			return { x: trigger.right + gap, y: trigger.bottom - panelSize.height };
		case "left-start":
			return { x: trigger.left - panelSize.width - gap, y: trigger.top };
		case "left-end":
			return { x: trigger.left - panelSize.width - gap, y: trigger.bottom - panelSize.height };
		case "bottom-start":
			return { x: trigger.left, y: trigger.bottom + gap };
		case "bottom-end":
			return { x: trigger.right - panelSize.width, y: trigger.bottom + gap };
		case "top-start":
			return { x: trigger.left, y: trigger.top - panelSize.height - gap };
		case "top-end":
			return { x: trigger.right - panelSize.width, y: trigger.top - panelSize.height - gap };
	}
};

const getOverflow = (position: Position, panelSize: Size, viewport: Viewport) =>
	Math.max(-position.x, 0) +
	Math.max(HEADER_HEIGHT - position.y, 0) +
	Math.max(position.x + panelSize.width - viewport.width, 0) +
	Math.max(position.y + panelSize.height - viewport.height, 0);

const getAnimationOrigin = (placement: Placement): PanelAnimationOrigin => {
	const isEnd = placement.endsWith("-end");
	if (placement.startsWith("top")) return isEnd ? "bottom-right" : "bottom-left";
	if (placement.startsWith("bottom")) return isEnd ? "top-right" : "top-left";
	if (placement.startsWith("left")) return isEnd ? "bottom-right" : "top-right";
	return isEnd ? "bottom-left" : "top-left";
};

export const getPanelPositionByTrigger = ({
	trigger,
	panelSize,
	viewport,
	gap,
}: GetPanelPositionByTriggerOptions): PanelTriggerPlacement => {
	const candidates = placements.map((placement) => {
		const position = getPosition(placement, trigger, panelSize, gap);
		return { placement, position, overflow: getOverflow(position, panelSize, viewport) };
	});
	const selected =
		candidates.find(({ overflow }) => overflow === 0) ??
		candidates.reduce((best, candidate) => (candidate.overflow < best.overflow ? candidate : best));

	return {
		position: {
			x: Math.min(Math.max(selected.position.x, 0), Math.max(viewport.width - panelSize.width, 0)),
			y: Math.min(
				Math.max(selected.position.y, HEADER_HEIGHT),
				Math.max(viewport.height - panelSize.height, HEADER_HEIGHT),
			),
		},
		animationOrigin: getAnimationOrigin(selected.placement),
	};
};
