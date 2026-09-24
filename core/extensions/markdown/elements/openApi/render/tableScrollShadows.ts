import { TABLE_PORT_CLASS, TABLE_SCROLL_CLASS } from "@ext/markdown/elements/openApi/render/openApiMarkdown";

/** Set while there is content past that edge — the CSS turns the matching shadow on. */
const MORE_LEFT = "data-more-left";
const MORE_RIGHT = "data-more-right";

/** A scroll position lands on fractional pixels; a pixel of slack keeps a shadow from flickering at an end. */
const EDGE_SLACK = 1;

/**
 * Turns the shadows on a scrolling table on and off, the way `ShadowBox` does it for an article table: an
 * edge is shaded only while there is something past it to scroll to.
 *
 * The state is written as attributes on the outer box and the gradients live in CSS, so nothing here paints.
 * Reads and writes are kept apart and the scroll handler is coalesced into a frame — a table can be several
 * screens wide, and this runs on every scroll event of it.
 */
const watchPort = (port: HTMLElement): (() => void) => {
	const box = port.parentElement;
	if (!box) return () => {};

	let frame = 0;
	const update = () => {
		frame = 0;
		const distanceToEnd = port.scrollWidth - port.clientWidth - port.scrollLeft;
		box.toggleAttribute(MORE_LEFT, port.scrollLeft > EDGE_SLACK);
		box.toggleAttribute(MORE_RIGHT, distanceToEnd > EDGE_SLACK);
	};
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(update);
	};

	port.addEventListener("scroll", schedule, { passive: true });
	// The table's own width changes with the article column, and its content changes with the spec.
	const observer = new ResizeObserver(schedule);
	observer.observe(port);
	update();

	return () => {
		if (frame) cancelAnimationFrame(frame);
		port.removeEventListener("scroll", schedule);
		observer.disconnect();
	};
};

/**
 * Attaches to every scrolling table under `root`. The viewer re-renders its whole subtree on each update, so
 * the caller re-runs this after one and drops the previous watchers — there is nothing to reuse across a
 * render, the elements themselves are gone.
 */
export const watchTableScrollShadows = (root: HTMLElement): (() => void) => {
	const cleanups = [...root.querySelectorAll<HTMLElement>(`.${TABLE_SCROLL_CLASS} > .${TABLE_PORT_CLASS}`)].map(
		watchPort,
	);
	return () => cleanups.forEach((cleanup) => cleanup());
};

export default watchTableScrollShadows;
