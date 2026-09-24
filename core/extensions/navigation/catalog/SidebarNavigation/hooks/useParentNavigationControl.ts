import { type RefObject, useEffect, useState } from "react";

export const useParentNavigationControl = (markerRef: RefObject<HTMLElement | null>, forceActive = false) => {
	const [isParentActive, setIsParentActive] = useState(false);

	useEffect(() => {
		const parent = markerRef.current?.parentElement;
		if (!parent) return;

		const activate = () => setIsParentActive(true);
		const deactivate = () => setIsParentActive(false);
		const deactivateFocus = (event: FocusEvent) => {
			if (event.relatedTarget instanceof Node && parent.contains(event.relatedTarget)) return;
			deactivate();
		};

		parent.addEventListener("pointerenter", activate);
		parent.addEventListener("pointerleave", deactivate);
		parent.addEventListener("focusin", activate);
		parent.addEventListener("focusout", deactivateFocus);

		return () => {
			parent.removeEventListener("pointerenter", activate);
			parent.removeEventListener("pointerleave", deactivate);
			parent.removeEventListener("focusin", activate);
			parent.removeEventListener("focusout", deactivateFocus);
		};
	}, [markerRef]);

	return forceActive || isParentActive;
};
