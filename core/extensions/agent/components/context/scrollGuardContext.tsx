import { createContext, type ReactNode, useContext, useLayoutEffect } from "react";
import type { ScrollGuardStore } from "../hooks/scrollGuardStore";

const noopScrollGuardStore: ScrollGuardStore = {
	hasOpenGuard: () => false,
	registerOpenGuard: () => () => {},
};

const ScrollGuardContext = createContext<ScrollGuardStore>(noopScrollGuardStore);

export const ScrollGuardProvider = ({ store, children }: { store: ScrollGuardStore; children: ReactNode }) => (
	<ScrollGuardContext.Provider value={store}>{children}</ScrollGuardContext.Provider>
);

export const useAutoScrollGuard = (open: boolean) => {
	const scrollGuardStore = useContext(ScrollGuardContext);

	useLayoutEffect(() => {
		if (!open) return;
		return scrollGuardStore.registerOpenGuard();
	}, [open, scrollGuardStore]);
};
