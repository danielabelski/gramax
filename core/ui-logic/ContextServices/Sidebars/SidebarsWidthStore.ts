import {
	LEFT_NAV_DEFAULT_WIDTH,
	LEFT_NAV_MAX_WIDTH,
	LEFT_NAV_MIN_WIDTH,
} from "@ext/navigation/catalog/SidebarNavigation/utils/constants";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LEFT_SIDEBAR_WIDTH_STORAGE_KEY } from "./leftSidebarBootstrap";

export interface SidebarsWidthState {
	leftWidth: number;
	setLeftWidth: (width: number) => void;
}

const clampLeftWidth = (width: number) => Math.min(Math.max(width, LEFT_NAV_MIN_WIDTH), LEFT_NAV_MAX_WIDTH);

export const useSidebarsWidthStore = create<SidebarsWidthState>()(
	persist(
		(set) => ({
			leftWidth: LEFT_NAV_DEFAULT_WIDTH,
			setLeftWidth: (width) => set({ leftWidth: clampLeftWidth(width) }),
		}),
		{
			name: LEFT_SIDEBAR_WIDTH_STORAGE_KEY,
			partialize: ({ leftWidth }) => ({ leftWidth }),
		},
	),
);
