import { useLayoutEffect } from "react";

const NATIVE_TITLEBAR_OFFSET = "1.45rem";

export const useNativeTitlebarOffset = (hasNativeTitlebar: boolean) => {
	useLayoutEffect(() => {
		if (!hasNativeTitlebar) return;

		document.documentElement.style.setProperty("--catalog-titlebar-offset", NATIVE_TITLEBAR_OFFSET);
		return () => {
			document.documentElement.style.removeProperty("--catalog-titlebar-offset");
		};
	}, [hasNativeTitlebar]);
};
