/**
 * Extra room kept between the focused row and the container edge. The container fades its
 * first and last pixels out under a scroll shadow, and a row parked exactly on the edge
 * lands under that fade.
 */
export const FOCUS_SCROLL_PADDING = 12;

// pixel/ms
const BASE_SPEED = 0.3;
const SPEED_FACTOR = 0.008;
const MAX_SPEED = 2;
const FRAME_MS = 16;
/** A frame after the tab was throttled must not translate into one huge jump. */
const MAX_FRAME_MS = 32;

export interface ScrollAnimation {
	to(container: HTMLElement, targetY: number): void;
	cancel(): void;
}

/**
 * Where the container has to scroll for `element` to sit fully inside it, or undefined when
 * it already does. The result is clamped to the scrollable range, so the first and last rows
 * land flush against their end instead of asking for a position that can never be reached.
 */
export const scrollTargetFor = (container: HTMLElement, element: HTMLElement): number | undefined => {
	if (!container.contains(element)) return undefined;

	const containerRect = container.getBoundingClientRect();
	const elementRect = element.getBoundingClientRect();
	const { scrollTop, scrollHeight, clientHeight } = container;

	const hiddenAbove = containerRect.top + FOCUS_SCROLL_PADDING - elementRect.top;
	const hiddenBelow = elementRect.bottom + FOCUS_SCROLL_PADDING - containerRect.bottom;
	const delta = hiddenAbove > 0 ? -hiddenAbove : hiddenBelow > 0 ? hiddenBelow : 0;
	if (!delta) return undefined;

	const targetY = clamp(scrollTop + delta, 0, Math.max(scrollHeight - clientHeight, 0));
	return targetY === scrollTop ? undefined : targetY;
};

export const scrollToElement = (container: HTMLElement, element: HTMLElement, animation: ScrollAnimation) => {
	const targetY = scrollTargetFor(container, element);
	if (targetY === undefined) return;

	animation.to(container, targetY);
};

export const createScrollAnimation = (): ScrollAnimation => {
	let frame: number | undefined;
	let lastTime: number | undefined;
	let lastScrollTop: number | undefined;

	const cancel = () => {
		if (frame !== undefined) cancelAnimationFrame(frame);
		frame = undefined;
		lastTime = undefined;
		lastScrollTop = undefined;
	};

	const to = (container: HTMLElement, targetY: number) => {
		cancel();

		const step = (time: number) => {
			const elapsed = lastTime === undefined ? FRAME_MS : Math.min(time - lastTime, MAX_FRAME_MS);
			lastTime = time;

			const currentY = container.scrollTop;
			if (currentY === lastScrollTop) return cancel();
			lastScrollTop = currentY;

			const distance = targetY - currentY;
			const speed = Math.min(BASE_SPEED + Math.abs(distance) * SPEED_FACTOR, MAX_SPEED);
			const advance = speed * elapsed * Math.sign(distance);

			if (Math.abs(advance) >= Math.abs(distance)) {
				container.scrollTop = targetY;
				return cancel();
			}

			container.scrollTop = currentY + advance;
			frame = requestAnimationFrame(step);
		};

		frame = requestAnimationFrame(step);
	};

	return { to, cancel };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
