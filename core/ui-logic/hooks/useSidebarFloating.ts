import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

export const SIDEBAR_TRIGGER_ATTR = "data-sidebar-trigger";

const CLOSE_DELAY_MS = 300;

const isPortalOwnedBySidebar = (target: Node, sidebarEl: HTMLElement): boolean => {
	if (document.body.style.pointerEvents === "none")
		return sidebarEl.querySelector('[data-state="open"][aria-haspopup]') !== null;

	if (!(target instanceof HTMLElement)) return false;

	const popperWrapper = target.closest("[data-radix-popper-content-wrapper]");
	if (!popperWrapper) return false;

	const contentWithId = popperWrapper.querySelector("[id]");
	if (!contentWithId) return false;

	const contentId = contentWithId.id;
	const trigger =
		sidebarEl.querySelector(`[aria-describedby="${contentId}"]`) ??
		sidebarEl.querySelector(`[aria-controls="${contentId}"]`);

	return trigger !== null;
};

const useSidebarFloating = (ref: RefObject<HTMLDivElement>, isCollapsed: boolean) => {
	const [isHoverActive, setIsHoverActive] = useState(false);

	const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
	const isOverRef = useRef(false);

	const clearTimer = useCallback(() => {
		if (!timerRef.current) return;
		clearTimeout(timerRef.current);
		timerRef.current = null;
	}, []);

	useEffect(() => {
		if (!isCollapsed) return;
		const scheduleClose = () => {
			clearTimer();
			timerRef.current = setTimeout(() => {
				setIsHoverActive(false);
				timerRef.current = null;
			}, CLOSE_DELAY_MS);
		};

		const handleMouseOver = (event: MouseEvent) => {
			const sidebarEl = ref.current;
			if (!sidebarEl) return;

			const target = event.target as Node;
			const isOverSidebar =
				sidebarEl.contains(target) ||
				(target instanceof Element && target.closest(`[${SIDEBAR_TRIGGER_ATTR}]`) !== null) ||
				isPortalOwnedBySidebar(target, sidebarEl);

			if (isOverSidebar === isOverRef.current) return;
			isOverRef.current = isOverSidebar;

			if (isOverSidebar) {
				clearTimer();
				setIsHoverActive(true);
				return;
			}

			scheduleClose();
		};
		const handleMouseOut = (event: MouseEvent) => {
			if (event.relatedTarget !== null || !isOverRef.current) return;
			isOverRef.current = false;
			scheduleClose();
		};
		const handleWindowBlur = () => {
			if (!isOverRef.current) return;
			isOverRef.current = false;
			scheduleClose();
		};

		document.addEventListener("mouseover", handleMouseOver);
		document.addEventListener("mouseout", handleMouseOut);
		window.addEventListener("blur", handleWindowBlur);

		return () => {
			document.removeEventListener("mouseover", handleMouseOver);
			document.removeEventListener("mouseout", handleMouseOut);
			window.removeEventListener("blur", handleWindowBlur);
			clearTimer();
			isOverRef.current = false;
		};
	}, [isCollapsed, ref, clearTimer]);

	useEffect(() => {
		if (isCollapsed) return;
		clearTimer();
		setIsHoverActive(false);
	}, [isCollapsed, clearTimer]);

	return { isHoverActive };
};

export default useSidebarFloating;
