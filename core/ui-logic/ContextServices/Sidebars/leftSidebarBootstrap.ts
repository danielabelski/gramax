import {
	LEFT_NAV_DEFAULT_WIDTH,
	LEFT_NAV_MAX_WIDTH,
	LEFT_NAV_MIN_WIDTH,
} from "@ext/navigation/catalog/SidebarNavigation/utils/constants";

export const LEFT_SIDEBAR_PIN_STORAGE_KEY = "SidebarsIsPin";
export const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = "SidebarsWidth";

export const LEFT_SIDEBAR_BOOTSTRAP_SCRIPT = `try {
	const value = localStorage.getItem("${LEFT_SIDEBAR_PIN_STORAGE_KEY}");
	let isPinned = true;
	if (value === "false") isPinned = false;
	else if (value && value !== "true") {
		const state = JSON.parse(value)?.state;
		isPinned = state?.isLeftPinned ?? state?.left ?? true;
	}
	document.documentElement.dataset.leftSidebarPinned = String(isPinned);
} catch {
	document.documentElement.dataset.leftSidebarPinned = "true";
}
try {
	const value = localStorage.getItem("${LEFT_SIDEBAR_WIDTH_STORAGE_KEY}");
	const storedWidth = value ? JSON.parse(value)?.state?.leftWidth : undefined;
	const width = typeof storedWidth === "number" && Number.isFinite(storedWidth)
		? Math.min(Math.max(storedWidth, ${LEFT_NAV_MIN_WIDTH}), ${LEFT_NAV_MAX_WIDTH})
		: ${LEFT_NAV_DEFAULT_WIDTH};
	document.documentElement.style.setProperty("--left-nav-width", width + "px");
} catch {
	document.documentElement.style.setProperty("--left-nav-width", "${LEFT_NAV_DEFAULT_WIDTH}px");
}`;

export const applyLeftSidebarPinState = (isPinned: boolean) => {
	if (typeof document === "undefined") return;
	document.documentElement.dataset.leftSidebarPinned = String(isPinned);
};
