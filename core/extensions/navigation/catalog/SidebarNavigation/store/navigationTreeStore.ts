import type { CategoryLink, ItemLink } from "@ext/navigation/NavigationLinks";
import { createContext, createElement, type ReactNode, useContext, useRef } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createStore, type StateCreator } from "zustand/vanilla";
import { DropMode, type PersistedDropMode } from "../utils/dropMode";

export type DragTarget = {
	anchorId: string;
	parentId: string | null;
	mode: DropMode;
} | null;

const EMPTY_DRAG_LINE_IDS: ReadonlySet<string> = new Set();

const sameDragTarget = (left: DragTarget, right: DragTarget): boolean =>
	left === right ||
	(!!left &&
		!!right &&
		left.anchorId === right.anchorId &&
		left.parentId === right.parentId &&
		left.mode === right.mode);

const getDragLineIds = (target: DragTarget, childrenMap: ChildrenMap): ReadonlySet<string> => {
	if (target?.mode !== DropMode.After || !target.parentId) return EMPTY_DRAG_LINE_IDS;
	const siblings = childrenMap[target.parentId];
	if (!siblings) return EMPTY_DRAG_LINE_IDS;
	const anchorIndex = siblings.indexOf(target.anchorId);
	return anchorIndex < 0 ? EMPTY_DRAG_LINE_IDS : new Set(siblings.slice(0, anchorIndex + 1));
};

// Flat index built from the nested ItemLink tree
export type FlatIndex = Record<string, ItemLink>;
export type ChildrenMap = Record<string, string[]>; // parentPath → childPaths[]
export type ParentMap = Record<string, string>; // childPath → parentPath

export const NAVIGATION_HOVER_ID_ATTR = "data-navigation-hover-id";
export const NAVIGATION_ROW_SELECTOR = `[${NAVIGATION_HOVER_ID_ATTR}]`;

export type NavigationTreeStore = {
	scope: string | null;
	flatIndex: FlatIndex;
	childrenMap: ChildrenMap;
	parentMap: ParentMap;
	rootIds: string[];
	expanded: ReadonlySet<string>;
	selectedId: string;
	hoveredParentId: string | null;
	hoveredAnchorId: string | null;
	hoveredNavigationId: string | null;
	draggingId: string | null;
	dragTarget: DragTarget;
	dragLineIds: ReadonlySet<string>;
	isDragLocked: boolean;
	/** Bumped when a collapse/expand animation settles, so measured rects can be refreshed. */
	layoutVersion: number;
	onDrop: ((draggedId: string, anchorId: string, mode: PersistedDropMode) => Promise<void>) | null;
	onToggle: ((id: string, open: boolean) => void) | null;
	onCreateArticle: ((parentId?: string, afterId?: string) => Promise<void>) | null;
	setDragLocked: (locked: boolean) => void;
	notifyLayoutSettled: () => void;
	toggleExpanded: (id: string, open: boolean) => void;
	select: (id: string) => void;
	setHover: (parentId: string | null, anchorId: string | null) => void;
	setHoveredNavigationId: (id: string | null) => void;
	setDragging: (id: string | null) => void;
	setDragTarget: (target: DragTarget) => void;
	setNavItems: (links: ItemLink[], scope?: string) => void;
	setOnDrop: (fn: NavigationTreeStore["onDrop"]) => void;
	setOnToggle: (fn: NavigationTreeStore["onToggle"]) => void;
	setOnCreateArticle: (fn: NavigationTreeStore["onCreateArticle"]) => void;
};

const sameItem = (a: ItemLink | undefined, b: ItemLink): boolean =>
	!!a &&
	a.type === b.type &&
	a.title === b.title &&
	a.icon === b.icon &&
	a.isCurrentLink === b.isCurrentLink &&
	a.pathname === b.pathname &&
	a.external === b.external &&
	a.status === b.status &&
	(a as CategoryLink).isExpanded === (b as CategoryLink).isExpanded &&
	(a as CategoryLink).existContent === (b as CategoryLink).existContent;

const sameIds = (a: string[] | undefined, b: string[]): boolean =>
	!!a && a.length === b.length && a.every((id, i) => id === b[i]);

export const buildFlatIndex = (
	links: ItemLink[],
	previous: FlatIndex,
	previousChildren: ChildrenMap,
	previousParents: ParentMap,
) => {
	const flatIndex: FlatIndex = {};
	const childrenMap: ChildrenMap = {};
	const parentMap: ParentMap = {};

	const visit = (link: ItemLink) => {
		const id = link.ref.path;
		flatIndex[id] = sameItem(previous[id], link) ? previous[id] : link;

		const children = (link as CategoryLink).items ?? [];
		const childIds = children.map((c) => c.ref.path);
		childrenMap[id] = sameIds(previousChildren[id], childIds) ? previousChildren[id] : childIds;

		children.forEach((child) => {
			parentMap[child.ref.path] = id;
			visit(child);
		});
	};

	const rootIds = links.map((link) => {
		visit(link);
		return link.ref.path;
	});

	const sameMap = <T>(before: Record<string, T>, after: Record<string, T>): boolean => {
		const keys = Object.keys(after);
		return keys.length === Object.keys(before).length && keys.every((key) => before[key] === after[key]);
	};

	return {
		flatIndex: sameMap(previous, flatIndex) ? previous : flatIndex,
		childrenMap: sameMap(previousChildren, childrenMap) ? previousChildren : childrenMap,
		parentMap: sameMap(previousParents, parentMap) ? previousParents : parentMap,
		rootIds,
	};
};

export const reconcileExpansion = (
	nextIndex: FlatIndex,
	previousIndex: FlatIndex,
	previousExpanded: ReadonlySet<string>,
): { expanded: Set<string>; selectedId: string } => {
	const expanded = new Set(previousExpanded);
	let selectedId = "";

	for (const link of Object.values(nextIndex)) {
		const id = link.ref.path;
		if (!previousIndex[id] && (link as CategoryLink).isExpanded) expanded.add(id);
		if (link.isCurrentLink) selectedId = id;
	}

	for (const id of previousExpanded) if (!nextIndex[id]) expanded.delete(id);

	return { expanded, selectedId };
};

const getAutoExpanded = (selectedId: string, parentMap: ParentMap): Set<string> => {
	const autoExpanded = new Set<string>();
	let parentId = parentMap[selectedId];
	while (parentId) {
		autoExpanded.add(parentId);
		parentId = parentMap[parentId];
	}
	return autoExpanded;
};

const createInitialNavigationTreeState = (links: ItemLink[], scope: string | null) => {
	const { flatIndex, childrenMap, parentMap, rootIds } = buildFlatIndex(links, {}, {}, {});
	const { expanded, selectedId } = reconcileExpansion(flatIndex, {}, new Set<string>());
	for (const id of getAutoExpanded(selectedId, parentMap)) expanded.add(id);

	return {
		scope,
		flatIndex,
		childrenMap,
		parentMap,
		rootIds,
		expanded,
		selectedId,
		hoveredParentId: null,
		hoveredAnchorId: null,
		hoveredNavigationId: null,
		draggingId: null,
		dragTarget: null,
		dragLineIds: EMPTY_DRAG_LINE_IDS,
		isDragLocked: false,
		layoutVersion: 0,
		onDrop: null,
		onToggle: null,
		onCreateArticle: null,
	};
};

const createNavigationTreeState =
	(initialLinks: ItemLink[], initialScope: string | null): StateCreator<NavigationTreeStore> =>
	(set) => ({
		...createInitialNavigationTreeState(initialLinks, initialScope),

		toggleExpanded: (id, open) =>
			set((state) => {
				state.onToggle?.(id, open);
				const next = new Set(state.expanded);
				if (open) next.add(id);
				else {
					const stack = [id];
					while (stack.length) {
						const current = stack.pop()!;
						next.delete(current);
						for (const child of state.childrenMap[current] ?? []) stack.push(child);
					}
				}
				return { expanded: next };
			}),

		select: (id) =>
			set((state) => {
				state.onToggle?.(id, true);
				const next = new Set(state.expanded);
				next.add(id);
				return { selectedId: id, expanded: next };
			}),

		setHover: (parentId, anchorId) =>
			set((state) => {
				if (state.hoveredParentId === parentId && state.hoveredAnchorId === anchorId) return state;
				return { hoveredParentId: parentId, hoveredAnchorId: anchorId };
			}),

		setHoveredNavigationId: (id) =>
			set((state) => (state.hoveredNavigationId === id ? state : { hoveredNavigationId: id })),

		setDragging: (id) => set({ draggingId: id, dragTarget: null, dragLineIds: EMPTY_DRAG_LINE_IDS }),

		setDragTarget: (target) =>
			set((state) =>
				sameDragTarget(state.dragTarget, target)
					? state
					: { dragTarget: target, dragLineIds: getDragLineIds(target, state.childrenMap) },
			),

		setNavItems: (links, scope) =>
			set((state) => {
				const nextScope = scope ?? state.scope;
				const scopeChanged = nextScope !== state.scope;
				const previousIndex = scopeChanged ? {} : state.flatIndex;
				const previousSelectedId =
					Object.values(previousIndex).find((item) => item.isCurrentLink)?.ref.path ?? "";
				const previousChildren = scopeChanged ? {} : state.childrenMap;
				const previousParents = scopeChanged ? {} : state.parentMap;
				const previousExpanded = scopeChanged ? new Set<string>() : state.expanded;
				const previousAutoExpanded = scopeChanged
					? new Set<string>()
					: getAutoExpanded(previousSelectedId, state.parentMap);
				const { flatIndex, childrenMap, parentMap, rootIds } = buildFlatIndex(
					links,
					previousIndex,
					previousChildren,
					previousParents,
				);

				const { expanded, selectedId } = reconcileExpansion(flatIndex, previousIndex, previousExpanded);
				if (scopeChanged || selectedId !== previousSelectedId) {
					const autoExpanded = getAutoExpanded(selectedId, parentMap);

					for (const id of previousAutoExpanded) {
						if (autoExpanded.has(id)) continue;
						const item = flatIndex[id] as CategoryLink | undefined;
						if (item?.isExpanded) expanded.add(id);
						else expanded.delete(id);
					}
					for (const id of autoExpanded) expanded.add(id);
				}

				return {
					scope: nextScope,
					flatIndex,
					childrenMap,
					dragLineIds: scopeChanged ? EMPTY_DRAG_LINE_IDS : getDragLineIds(state.dragTarget, childrenMap),
					parentMap,
					rootIds: !scopeChanged && sameIds(state.rootIds, rootIds) ? state.rootIds : rootIds,
					expanded,
					selectedId,
					...(scopeChanged && {
						hoveredParentId: null,
						hoveredAnchorId: null,
						hoveredNavigationId: null,
						draggingId: null,
						dragTarget: null,
						isDragLocked: false,
					}),
				};
			}),

		setDragLocked: (locked) => set({ isDragLocked: locked }),
		notifyLayoutSettled: () => set((state) => ({ layoutVersion: state.layoutVersion + 1 })),
		setOnDrop: (fn) => set({ onDrop: fn }),
		setOnToggle: (fn) => set({ onToggle: fn }),
		setOnCreateArticle: (fn) => set({ onCreateArticle: fn }),
	});

export const createNavigationTreeStore = (initialLinks: ItemLink[] = [], scope: string | null = null) =>
	createStore<NavigationTreeStore>()(createNavigationTreeState(initialLinks, scope));

export type NavigationTreeStoreApi = ReturnType<typeof createNavigationTreeStore>;

const NavigationTreeStoreContext = createContext<NavigationTreeStoreApi | null>(null);

export const NavigationTreeStoreProvider = ({
	children,
	initialLinks,
	scope,
}: {
	children?: ReactNode;
	initialLinks: ItemLink[];
	scope: string;
}) => {
	const storeRef = useRef<NavigationTreeStoreApi | null>(null);
	if (storeRef.current === null) storeRef.current = createNavigationTreeStore(initialLinks, scope);

	return createElement(NavigationTreeStoreContext.Provider, { value: storeRef.current }, children);
};

/** Fallback store for consumers outside a scoped provider and imperative test setup. */
export const navigationTreeStore = createNavigationTreeStore();

export const useNavigationTreeStoreApi = (): NavigationTreeStoreApi =>
	useContext(NavigationTreeStoreContext) ?? navigationTreeStore;

export const useNavigationTreeStore = <T>(selector: (state: NavigationTreeStore) => T): T =>
	useStore(useNavigationTreeStoreApi(), useShallow(selector));
