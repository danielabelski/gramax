import { useCallbackRef } from "@core-ui/hooks/useCallbackRef";
import { useLayoutEffect, useState } from "react";

/**
 * Reports the width of the element the returned ref is attached to, on mount and on every resize.
 * One observer per element: pass the width on to a store when several components need it.
 */
export const useWidthObserver = (onWidth: (width: number) => void) => {
	const [element, setElement] = useState<HTMLElement | null>(null);
	const reportWidth = useCallbackRef(onWidth);

	useLayoutEffect(() => {
		if (!element) return;

		reportWidth(element.getBoundingClientRect().width);
		if (typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver(([entry]) => reportWidth(entry.contentRect.width));
		observer.observe(element);

		return () => observer.disconnect();
	}, [element, reportWidth]);

	return setElement;
};
