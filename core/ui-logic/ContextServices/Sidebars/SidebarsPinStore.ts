import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { applyLeftSidebarPinState, LEFT_SIDEBAR_PIN_STORAGE_KEY } from "./leftSidebarBootstrap";

const STORAGE_VERSION = 1;

export interface SidebarsPinState {
	isLeftPinned: boolean;
	setLeftPinned: (value: boolean) => void;
	toggleLeftPinned: () => void;
}

const storage: StateStorage = {
	getItem: (name) => {
		const value = localStorage.getItem(name);
		if (value === "true" || value === "false") {
			return JSON.stringify({
				state: { isLeftPinned: value === "true" },
				version: 0,
			});
		}
		return value;
	},
	setItem: (name, value) => localStorage.setItem(name, value),
	removeItem: (name) => localStorage.removeItem(name),
};

export const useSidebarsPinStore = create<SidebarsPinState>()(
	persist(
		(set) => ({
			isLeftPinned: true,
			setLeftPinned: (isLeftPinned) => {
				applyLeftSidebarPinState(isLeftPinned);
				set({ isLeftPinned });
			},
			toggleLeftPinned: () =>
				set((state) => {
					const isLeftPinned = !state.isLeftPinned;
					applyLeftSidebarPinState(isLeftPinned);
					return { isLeftPinned };
				}),
		}),
		{
			name: LEFT_SIDEBAR_PIN_STORAGE_KEY,
			onRehydrateStorage: () => (state) => {
				if (state) applyLeftSidebarPinState(state.isLeftPinned);
			},
			partialize: ({ isLeftPinned }) => ({ isLeftPinned }),
			storage: createJSONStorage(() => storage),
			version: STORAGE_VERSION,
			migrate: (persistedState) => {
				const state = persistedState as { isLeftPinned?: boolean; left?: boolean };
				return {
					isLeftPinned: state.isLeftPinned ?? state.left ?? true,
				};
			},
		},
	),
);
