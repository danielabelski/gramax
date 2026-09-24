import type { Modifier } from "@dnd-kit/core";

export const restrictFloatingPanelToViewport: Modifier = ({ draggingNodeRect, transform, windowRect }) => {
	if (!draggingNodeRect || !windowRect) return transform;

	const restricted = { ...transform };

	if (draggingNodeRect.left + transform.x < windowRect.left) restricted.x = windowRect.left - draggingNodeRect.left;

	if (draggingNodeRect.top + transform.y < windowRect.top) restricted.y = windowRect.top - draggingNodeRect.top;
	else if (draggingNodeRect.bottom + transform.y > windowRect.top + windowRect.height)
		restricted.y = windowRect.top + windowRect.height - draggingNodeRect.bottom;

	return restricted;
};
