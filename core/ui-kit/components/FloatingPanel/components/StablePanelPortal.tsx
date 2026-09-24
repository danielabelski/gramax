import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

type StablePanelPortalProps = {
	target?: HTMLElement;
	children: React.ReactNode;
};

type ScrollPosition = { top: number; left: number };

const restoreScrollPositions = (positions: Map<Element, ScrollPosition>) => {
	positions.forEach(({ top, left }, element) => {
		element.scrollTop = top;
		element.scrollLeft = left;
	});
};

export const StablePanelPortal = ({ target, children }: StablePanelPortalProps) => {
	const rootRef = useRef<HTMLElement | null>(null);
	const scrollPositionsRef = useRef<Map<Element, ScrollPosition>>(new Map());

	if (!rootRef.current && target) {
		rootRef.current = target.ownerDocument.createElement("div");
		rootRef.current.style.display = "contents";
	}

	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root || !target) return;

		const positions = scrollPositionsRef.current;
		const recordScroll = (event: Event) => {
			const element = event.target;
			if (element instanceof Element) {
				positions.set(element, { top: element.scrollTop, left: element.scrollLeft });
			}
		};

		target.append(root);
		restoreScrollPositions(positions);
		root.addEventListener("scroll", recordScroll, { capture: true, passive: true });

		return () => {
			root.removeEventListener("scroll", recordScroll, { capture: true });
			if (root.parentElement === target) root.remove();
		};
	}, [target]);

	return rootRef.current ? createPortal(children, rootRef.current) : null;
};
