import type { ClientItemRef } from "@core/SitePresenter/SitePresenter";
import isSameItemRef from "@core-ui/utils/isSameItemRef";
import { followRenamedPath } from "@core-ui/utils/renameInFlight";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { createStore } from "zustand/vanilla";

export type ItemLinksStore = {
	itemLinks: ItemLink[];
	setItemLinks: (links: ItemLink[]) => void;
	patchItemProps: (patches: ItemLinkPatch[]) => void;
	renameLink: (from: ClientItemRef, to: ItemLinkMove) => void;
};

export type ItemLinkPatch = { ref: ClientItemRef; props: Partial<ItemLink> };
/** Where a renamed item went: its new ref and address, and the title that caused the move. */
export type ItemLinkMove = Pick<ItemLink, "ref" | "pathname" | "title">;

const hasLink = (links: ItemLink[], ref: ClientItemRef): boolean =>
	links.some((link) => isSameItemRef(link.ref, ref) || hasLink(childrenOf(link) ?? [], ref));

const childrenOf = (link: ItemLink): ItemLink[] | undefined =>
	"items" in link && Array.isArray(link.items) ? (link.items as ItemLink[]) : undefined;

// A renamed section takes its folder with it: every descendant's file and address gain the new prefix.
const moveSubtree = (links: ItemLink[], from: { path: string; pathname: string }, to: ItemLinkMove): ItemLink[] =>
	links.map((link) => {
		const path = followRenamedPath(link.ref.path, { from: from.path, to: to.ref.path });
		const pathname = link.pathname.startsWith(`${from.pathname}/`)
			? `${to.pathname}/${link.pathname.slice(from.pathname.length + 1)}`
			: link.pathname;
		const items = childrenOf(link);
		const moved = { ...link, ref: { ...link.ref, path }, pathname };
		if (items) (moved as { items?: ItemLink[] }).items = moveSubtree(items, from, to);
		return moved;
	});

const defaultInitState: { itemLinks: ItemLink[] } = { itemLinks: [] };

export const shouldReplaceItemLinks = (next: ItemLink[], current: ItemLink[]): boolean =>
	next.length > 0 || current.length === 0;

export const createItemLinksStore = (initState = defaultInitState) => {
	return createStore<ItemLinksStore>()((set) => ({
		...initState,
		setItemLinks: (links: ItemLink[]) => set({ itemLinks: links }),
		patchItemProps: (patches: ItemLinkPatch[]) =>
			set((state) => {
				if (!patches.length || !state.itemLinks?.length) return state;

				const patchLinks = (links: ItemLink[]): ItemLink[] => {
					let hasChanges = false;
					const newArr = links.map((link) => {
						const patch = patches.find((p) => isSameItemRef(p.ref, link.ref))?.props;
						const items =
							"items" in link && Array.isArray(link.items) ? (link.items as ItemLink[]) : undefined;
						const newItems = items ? patchLinks(items) : undefined;

						if (!patch && newItems === items) return link;

						hasChanges = true;
						const newLink = { ...link, ...patch };
						if (items) (newLink as { items?: ItemLink[] }).items = newItems;

						return newLink;
					});
					return hasChanges ? newArr : links;
				};

				const newLinks = patchLinks(state.itemLinks);
				return newLinks === state.itemLinks ? state : { itemLinks: newLinks };
			}),
		renameLink: (from, to) =>
			set((state) => {
				// The tree already read after the move holds the new ref; a link still matching `from` is
				// then a newcomer that reused the path, not the renamed item. A title-only rename keeps
				// the file — there the two refs are the same item, and the tree still needs the title.
				if (!isSameItemRef(from, to.ref) && hasLink(state.itemLinks, to.ref)) return state;

				const renameIn = (links: ItemLink[]): ItemLink[] => {
					let hasChanges = false;
					const next = links.map((link) => {
						const items = childrenOf(link);
						if (isSameItemRef(link.ref, from)) {
							hasChanges = true;
							const renamed = { ...link, ...to };
							if (items) {
								(renamed as { items?: ItemLink[] }).items = moveSubtree(
									items,
									{ path: from.path, pathname: link.pathname },
									to,
								);
							}
							return renamed;
						}
						const nextItems = items ? renameIn(items) : undefined;
						if (nextItems === items) return link;
						hasChanges = true;
						return { ...link, items: nextItems };
					});
					return hasChanges ? next : links;
				};

				const newLinks = renameIn(state.itemLinks);
				return newLinks === state.itemLinks ? state : { itemLinks: newLinks };
			}),
	}));
};
