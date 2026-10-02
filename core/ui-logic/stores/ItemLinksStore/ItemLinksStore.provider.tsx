import {
	createItemLinksStore,
	type ItemLinkPatch,
	type ItemLinksStore,
	shouldReplaceItemLinks,
} from "@core-ui/stores/ItemLinksStore/ItemLinksStore";
import NavigationEvents from "@ext/navigation/NavigationEvents";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

/**
 * How long a live rename/title patch overrides a stale `itemLinks` prop. The page is refetched right
 * after a save (see the item-rename listener below), and that refetch's tree can lag the write it is
 * reacting to — a full-catalog rescan racing the save that triggered it. Without this, the refetch's
 * stale title lands after the correct live one and the sidebar reverts.
 */
const RECENT_PATCH_MS = 8000;

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

	// Ref path -> patch applied outside a props refresh (a save's own item-rename), and when. Replayed
	// over the next `itemLinks` prop for RECENT_PATCH_MS so a refetch that raced the save it followed
	// can't bring the pre-save title back.
	const recentPatchesRef = useRef<Map<string, { patch: ItemLinkPatch; at: number }>>(new Map());

	useEffect(() => {
		const store = storeRef.current;
		if (!store || !shouldReplaceItemLinks(itemLinks, store.getState().itemLinks)) return;
		store.setState({ itemLinks });

		const now = Date.now();
		const replay: ItemLinkPatch[] = [];
		for (const [path, { patch, at }] of recentPatchesRef.current) {
			if (now - at > RECENT_PATCH_MS) {
				recentPatchesRef.current.delete(path);
				continue;
			}
			replay.push(patch);
		}
		if (replay.length) store.getState().patchItemProps(replay);
	}, [itemLinks]);

	// A renamed article keeps its place in the tree, and the page is not re-read for that.
	useEffect(() => {
		const token = NavigationEvents.on("item-rename", ({ from, patch: { ref, pathname, title } }) => {
			recentPatchesRef.current.set(ref.path, {
				patch: { ref, props: { ref, pathname, title } },
				at: Date.now(),
			});
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
