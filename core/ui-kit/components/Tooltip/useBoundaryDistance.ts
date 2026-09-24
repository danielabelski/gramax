import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * Distance from the trigger's right edge to the right edge of the nearest `selector` ancestor,
 * kept in sync while the tooltip is open. Row controls that animate in shrink the trigger under an
 * already-open tooltip, and floating-ui re-anchors to the new edge with the old offset — measuring
 * once on open would let the tooltip slide back over those controls.
 */
export const useBoundaryDistance = (
	triggerRef: RefObject<HTMLElement>,
	selector: string | undefined,
	isActive: boolean,
) => {
	const [distance, setDistance] = useState(0);

	useLayoutEffect(() => {
		const trigger = triggerRef.current;
		if (!isActive || !selector || !trigger) return;

		const boundary = trigger.closest(selector);
		if (!boundary) return;

		let frame = 0;

		const measure = () => {
			frame = 0;
			const next = Math.max(0, boundary.getBoundingClientRect().right - trigger.getBoundingClientRect().right);
			setDistance((current) => (current === next ? current : next));
		};

		const observer = new ResizeObserver(() => {
			if (!frame) frame = requestAnimationFrame(measure);
		});
		observer.observe(trigger);
		observer.observe(boundary);
		measure();

		return () => {
			if (frame) cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [isActive, selector, triggerRef]);

	return distance;
};
