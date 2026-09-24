import {
	createItemLinksStore,
	type ItemLinksStore,
	shouldReplaceItemLinks,
} from "@core-ui/stores/ItemLinksStore/ItemLinksStore";
import NavigationEvents from "@ext/navigation/NavigationEvents";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

type ItemLinksStoreApi = ReturnType<typeof createItemLinksStore>;

const ItemLinksStoreContext = createContext<ItemLinksStoreApi | undefined>(undefined);

interface ItemLinksStoreProviderProps {
	children: ReactNode;
	itemLinks: ItemLink[];
}

export const ItemLinksStoreProvider = ({ children, itemLinks }: ItemLinksStoreProviderProps) => {
	const storeRef = useRef<ItemLinksStoreApi>(null);

	if (storeRef.current === null) {
		storeRef.current = createItemLinksStore({ itemLinks });
	}

	useEffect(() => {
		const store = storeRef.current;
		if (store && shouldReplaceItemLinks(itemLinks, store.getState().itemLinks)) store.setState({ itemLinks });
	}, [itemLinks]);

	// A renamed article keeps its place in the tree, and the page is not re-read for that.
	useEffect(() => {
		const token = NavigationEvents.on("item-rename", ({ from, patch: { ref, pathname, title } }) => {
			storeRef.current?.getState().renameLink(from, { ref, pathname, title });
		});
		return () => NavigationEvents.off(token);
	}, []);

	if (storeRef.current === null) return null;
	return <ItemLinksStoreContext.Provider value={storeRef.current}>{children}</ItemLinksStoreContext.Provider>;
};

export const useItemLinksStore = <T,>(
	selector: (store: ItemLinksStore) => T,
	equalityFn?: ((a: T, b: T) => boolean) | "shallow",
): T => {
	const ctx = useContext(ItemLinksStoreContext);
	if (!ctx)
		return selector({
			itemLinks: [],
			setItemLinks: () => undefined,
			patchItemProps: () => undefined,
			renameLink: () => undefined,
		});

	const actualEqualityFn = equalityFn === "shallow" ? shallow : equalityFn;
	return useStoreWithEqualityFn(ctx, selector, actualEqualityFn);
};

export const useItemLinks = (): ItemLink[] => useItemLinksStore((s) => s.itemLinks);
