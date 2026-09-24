import { useSidebarsPinStore } from "@core-ui/ContextServices/Sidebars/SidebarsPinStore";
import { useWidthObserver } from "@core-ui/hooks/useWidthObserver";
import { create } from "zustand";
import { RIGHT_NAVIGATION_EXPAND_WIDTH_PINNED, RIGHT_NAVIGATION_EXPAND_WIDTH_UNPINNED } from "./constants";

interface CatalogViewportWidthState {
	width: number | null;
	setWidth: (width: number) => void;
}

export const useCatalogViewportWidthStore = create<CatalogViewportWidthState>((set) => ({
	width: null,
	setWidth: (width) => set((state) => (state.width === width ? state : { width })),
}));

/** The single observer of the `catalog-viewport` container; every consumer reads the store instead. */
export const useObserveCatalogViewportWidth = () => {
	const setWidth = useCatalogViewportWidthStore((state) => state.setWidth);

	return useWidthObserver(setWidth);
};

export const useIsRightNavigationCollapsed = () => {
	const width = useCatalogViewportWidthStore((state) => state.width);
	const isLeftPinned = useSidebarsPinStore((state) => state.isLeftPinned);

	if (width === null) return false;
	return width < (isLeftPinned ? RIGHT_NAVIGATION_EXPAND_WIDTH_PINNED : RIGHT_NAVIGATION_EXPAND_WIDTH_UNPINNED);
};
