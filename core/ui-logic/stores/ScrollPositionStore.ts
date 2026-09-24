import { create } from "zustand";

interface ScrollPositionMap {
	[articlePath: string]: number;
}

interface ScrollPositionStore {
	positions: ScrollPositionMap;
	isProgrammaticScroll: boolean;
	isRestoringScrollPosition: boolean;
	setPosition: (articlePath: string, position: number) => void;
	getPosition: (articlePath: string) => number | undefined;
	movePosition: (fromArticlePath: string, toArticlePath: string) => void;
	clearPosition: (articlePath: string) => void;
	clearAll: () => void;
	setProgrammaticScroll: (value: boolean) => void;
	setRestoringScrollPosition: (value: boolean) => void;
}

export const useScrollPositionStore = create<ScrollPositionStore>((set, get) => ({
	positions: {},
	isProgrammaticScroll: false,
	isRestoringScrollPosition: false,

	setPosition: (articlePath: string, position: number) => {
		set((state) => ({
			positions: { ...state.positions, [articlePath]: position },
		}));
	},

	getPosition: (articlePath: string) => {
		return get().positions[articlePath];
	},

	// Positions are keyed by address, and a rename moves the address under the same open article.
	movePosition: (fromArticlePath: string, toArticlePath: string) => {
		set((state) => {
			if (!(fromArticlePath in state.positions)) return state;
			const { [fromArticlePath]: position, ...rest } = state.positions;
			return { positions: { ...rest, [toArticlePath]: position } };
		});
	},

	clearPosition: (articlePath: string) => {
		set((state) => {
			const { [articlePath]: _, ...rest } = state.positions;
			return { positions: rest };
		});
	},

	clearAll: () => {
		set({ positions: {} });
	},

	setProgrammaticScroll: (value: boolean) => {
		set({ isProgrammaticScroll: value });
	},

	setRestoringScrollPosition: (value: boolean) => {
		set({ isRestoringScrollPosition: value });
	},
}));
