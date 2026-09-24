import type { MouseEvent, PointerEvent } from "react";

/**
 * Helpers for elements that copy their content on click and report it in their own tooltip:
 * inline code, revision ids, agent answers and tool payloads.
 */

/** True when the click came from a finger, where tooltips never open at all. */
export const isTouchClick = (event: MouseEvent<Element>): boolean =>
	(event.nativeEvent as globalThis.PointerEvent).pointerType === "touch";

/**
 * Keeps an already open tooltip from closing on click, so it can switch to "copied".
 * Skipped on touch: preventing the default there can swallow the click itself.
 */
export const keepTooltipOpen = (event: PointerEvent<Element>): void => {
	if (event.pointerType !== "touch") event.preventDefault();
};
