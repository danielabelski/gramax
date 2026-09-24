import { useCallback, useRef } from "react";

export const usePanelActivation = (
	onActivate: (() => void) | undefined,
	setDragNodeRef: (node: HTMLElement | null) => void,
) => {
	const nodeRef = useRef<HTMLElement | null>(null);

	return useCallback(
		(node: HTMLElement | null) => {
			if (onActivate) nodeRef.current?.removeEventListener("pointerdown", onActivate, true);
			nodeRef.current = node;
			// Native capture follows the DOM across stable portals and runs before content stops propagation.
			if (onActivate) node?.addEventListener("pointerdown", onActivate, true);
			setDragNodeRef(node);
		},
		[onActivate, setDragNodeRef],
	);
};
