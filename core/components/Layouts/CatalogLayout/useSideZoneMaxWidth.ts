import { useWidthObserver } from "@core-ui/hooks/useWidthObserver";
import { useState } from "react";

export const useSideZoneMaxWidth = () => {
	const [maxWidth, setMaxWidth] = useState<number>();
	const resizeBoundaryRef = useWidthObserver((width) => {
		if (width <= 0) return;
		setMaxWidth((currentWidth) => (currentWidth === width ? currentWidth : width));
	});

	return { maxWidth, resizeBoundaryRef };
};
