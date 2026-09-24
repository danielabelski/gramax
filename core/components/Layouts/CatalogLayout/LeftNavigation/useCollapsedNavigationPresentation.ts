import { type TransitionEventHandler, useCallback, useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const getPrefersReducedMotion = () =>
	typeof window !== "undefined" && window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;

const usePrefersReducedMotion = () => {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;

		const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
		const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

		handleChange();
		if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", handleChange);
		else mediaQuery.addListener?.(handleChange);

		return () => {
			if (mediaQuery.removeEventListener) mediaQuery.removeEventListener("change", handleChange);
			else mediaQuery.removeListener?.(handleChange);
		};
	}, []);

	return prefersReducedMotion;
};

export const useCollapsedNavigationPresentation = (isCollapsed: boolean, shouldCollapseImmediately = false) => {
	const [isCollapsedPresentation, setIsCollapsedPresentation] = useState(isCollapsed);
	const prefersReducedMotion = usePrefersReducedMotion();

	useEffect(() => {
		if (!isCollapsed) {
			setIsCollapsedPresentation(false);
			return;
		}

		if (shouldCollapseImmediately || prefersReducedMotion) {
			setIsCollapsedPresentation(true);
			return;
		}
	}, [isCollapsed, prefersReducedMotion, shouldCollapseImmediately]);

	const handleTransitionEnd = useCallback<TransitionEventHandler<HTMLDivElement>>(
		(event) => {
			if (!isCollapsed || event.target !== event.currentTarget || event.propertyName !== "left") return;
			setIsCollapsedPresentation(true);
		},
		[isCollapsed],
	);

	return { handleTransitionEnd, isCollapsedPresentation };
};
