import { useSidebarsWidthStore } from "@core-ui/ContextServices/Sidebars/SidebarsWidthStore";
import { useCallback, useLayoutEffect, useRef } from "react";

const LEFT_NAV_WIDTH_VAR = "--left-nav-width";

// The width lives in a CSS variable instead of React state: a resize drag must not re-render the catalog tree.
const useLeftNavigationWidthVar = () => {
	const frameRef = useRef<number>(null);
	const widthRef = useRef(0);

	const setWidthVar = useCallback((width: number) => {
		widthRef.current = width;
		if (frameRef.current !== null) return;

		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null;
			document.documentElement.style.setProperty(LEFT_NAV_WIDTH_VAR, `${widthRef.current}px`);
		});
	}, []);

	useLayoutEffect(() => {
		const width = useSidebarsWidthStore.getState().leftWidth;

		widthRef.current = width;
		document.documentElement.style.setProperty(LEFT_NAV_WIDTH_VAR, `${width}px`);
		const unsubscribe = useSidebarsWidthStore.subscribe((state) => setWidthVar(state.leftWidth));

		return () => {
			unsubscribe();
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
		};
	}, [setWidthVar]);

	return setWidthVar;
};

export default useLeftNavigationWidthVar;
