import type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import t from "@ext/localization/locale/translate";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { selectHomeSections, useHomepageLayoutStore } from "../store/homepageLayoutStore";
import { type HomeFolder, type HomeSections, isHomeFolder } from "../utils/homeLayoutTypes";
import { mergeItems } from "../utils/mergeItems";
import { createHomepageCollisionDetection } from "./homepageCollisionDetection";
import { GROUP_ID_PREFIX, itemKind, rawIdOf, toHomeItemKind } from "./ids";
import { moveHomeItem } from "./itemMovement";
import { useHomeDndSensors } from "./sensors";
import type { ActiveDrag } from "./types";
import { useHomepageMerge } from "./useHomepageMerge";

/** Common part of `onDragMove` / `onDragOver` event parsing. `activeKind` is null while dragging a section. */
const dragContext = (event: DragMoveEvent | DragOverEvent) => {
	const { active, over } = event;
	if (!over) return null;
	const activeId = String(active.id);
	const overId = String(over.id);
	const activeKind = itemKind(activeId);
	if (!activeKind) return { activeId, overId, activeKind: null } as const;
	return { activeId, overId, activeKind, rawId: rawIdOf(activeId, activeKind) };
};

export const useHomepageDnd = (sourceSections: HomeSections, linkByName: Record<string, CatalogLink>) => {
	const setSections = useHomepageLayoutStore((state) => state.setSections);
	const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
	const [dndSections, setDndSections] = useState(sourceSections);

	const dndSectionsRef = useRef(dndSections);
	const hasReorderedRef = useRef(false);

	/**
	 * The only writer of `dndSectionsRef` — keeps the ref and the render state in sync. The write MUST stay
	 * synchronous: `onDragEnd` flushes a pending merge exit reorder and then reads the ref on the next line, so
	 * deferring this (`startTransition`, `requestAnimationFrame`, …) would commit a stale layout.
	 */
	const applyDnd = useCallback((next: HomeSections) => {
		if (next === dndSectionsRef.current) return;
		dndSectionsRef.current = next;
		setDndSections(next);
	}, []);

	/**
	 * Reads the ref rather than the render state, which is what makes it safe to memoize: `scheduleMergeExitReorder`
	 * runs the closure a frame late, and that stale closure still sees the live layout.
	 */
	const reorder = useCallback(
		(updater: (prev: HomeSections) => HomeSections) => {
			hasReorderedRef.current = true;
			applyDnd(updater(dndSectionsRef.current));
		},
		[applyDnd],
	);

	const { dropIndicator, layoutAnimationTick, actions: merge } = useHomepageMerge({ applyReorder: reorder });

	const sensors = useHomeDndSensors();

	useLayoutEffect(() => {
		if (!activeDrag) applyDnd(sourceSections);
	}, [activeDrag, sourceSections, applyDnd]);

	const collisionDetection = useMemo(() => createHomepageCollisionDetection(() => dndSectionsRef.current), []);

	const reorderSections = useCallback(
		(activeId: string, overId: string) => {
			if (!activeId.startsWith(GROUP_ID_PREFIX) || !overId.startsWith(GROUP_ID_PREFIX)) return;
			const fromKey = activeId.slice(GROUP_ID_PREFIX.length);
			const toKey = overId.slice(GROUP_ID_PREFIX.length);
			const prev = dndSectionsRef.current;
			const fromIdx = prev.findIndex((section) => section.id === fromKey);
			const toIdx = prev.findIndex((section) => section.id === toKey);
			if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
			applyDnd(arrayMove(prev, fromIdx, toIdx));
		},
		[applyDnd],
	);

	const onDragStart = useCallback(
		(event: DragStartEvent) => {
			merge.reset();
			hasReorderedRef.current = false;
			const id = String(event.active.id);
			if (id.startsWith(GROUP_ID_PREFIX)) {
				const key = id.slice(GROUP_ID_PREFIX.length);
				const section = dndSectionsRef.current.find((s) => s.id === key);
				setActiveDrag({ type: "group", key, title: section?.title || t("new-section") });
				return;
			}
			const kind = itemKind(id);
			if (kind === "card") {
				setActiveDrag({ type: "card", name: rawIdOf(id, "card") });
			} else if (kind === "folder") {
				const fId = rawIdOf(id, "folder");
				const folder = dndSectionsRef.current
					.flatMap((section) => section.items)
					.find((i): i is HomeFolder => isHomeFolder(i) && i.id === fId);
				if (folder) setActiveDrag({ type: "folder", folder });
			}
		},
		[merge],
	);

	const onDragMove = useCallback(
		(event: DragMoveEvent) => {
			const ctx = dragContext(event);
			if (!ctx) {
				merge.clearMergeTarget();
				return;
			}
			if (!ctx.activeKind) return;
			const { activeId, overId, activeKind, rawId } = ctx;

			merge.noteOverTarget(overId);

			const overKind = activeKind === "card" && overId !== activeId ? itemKind(overId) : null;
			if (overKind && !merge.isReorderedOff(overId) && merge.isMergeActive(event, overId)) {
				merge.markMerging(overId);
				merge.setMergeTarget(overKind, rawIdOf(overId, overKind));
				return;
			}

			const exitedMerge = merge.takeExitedMerge(overId);
			merge.clearMergeTarget();

			if (overKind && exitedMerge) {
				merge.scheduleMergeExitReorder(overId, (prev) => moveHomeItem(prev, "card", rawId, overId, true));
				merge.markReorderedOff(overId);
				return;
			}
			if (overId === activeId || merge.isReorderedOff(overId) || merge.isMergeExitReorderTarget(overId)) return;
			merge.cancelMergeExitReorderFrame();
			reorder((prev) => moveHomeItem(prev, activeKind, rawId, overId, true));
		},
		[merge, reorder],
	);

	const onDragOver = useCallback(
		(event: DragOverEvent) => {
			const ctx = dragContext(event);
			if (!ctx) {
				merge.clearMergeTarget();
				return;
			}
			if (!ctx.activeKind) {
				reorderSections(ctx.activeId, ctx.overId);
				return;
			}
			const { activeId, overId, activeKind, rawId } = ctx;

			const overKind = itemKind(overId);
			if (activeKind === "card" && overKind && overId !== activeId && merge.isMergeActive(event, overId)) {
				merge.setMergeTarget(overKind, rawIdOf(overId, overKind));
				return;
			}

			merge.clearMergeTarget();
			if (overId === activeId || merge.isMergeExitReorderTarget(overId)) return;
			merge.cancelMergeExitReorderFrame();
			reorder((prev) => moveHomeItem(prev, activeKind, rawId, overId, true));
		},
		[merge, reorder, reorderSections],
	);

	const onDragCancel = useCallback(() => {
		merge.reset();
		hasReorderedRef.current = false;
		setActiveDrag(null);
		applyDnd(selectHomeSections(useHomepageLayoutStore.getState()));
	}, [merge, applyDnd]);

	const onDragEnd = useCallback(
		(event: DragEndEvent) => {
			merge.flushMergeExitReorder();
			const { active, over } = event;
			const items = dndSectionsRef.current;
			const hasReordered = hasReorderedRef.current;
			hasReorderedRef.current = false;
			merge.reset();
			setActiveDrag(null);

			if (!over) {
				if (hasReordered) setSections(items);
				return;
			}

			const activeId = String(active.id);
			if (activeId.startsWith(GROUP_ID_PREFIX)) {
				setSections(items);
				return;
			}

			const activeKind = itemKind(activeId);
			if (!activeKind) return;

			if (!dropIndicator) {
				setSections(items);
				return;
			}
			if (activeKind !== "card") return;

			const titleOf = (name: string) => linkByName[name]?.title || name;
			const activeRawId = rawIdOf(activeId, activeKind);
			const merged = mergeItems(
				items,
				activeRawId,
				toHomeItemKind(dropIndicator.targetType),
				dropIndicator.targetId,
				`${titleOf(dropIndicator.targetId)} & ${titleOf(activeRawId)}`,
			);
			if (!merged) return;
			applyDnd(merged);
			setSections(merged);
		},
		[merge, dropIndicator, applyDnd, setSections, linkByName],
	);

	return {
		sensors,
		collisionDetection,
		dndSections,
		activeDrag,
		dropIndicator,
		layoutAnimationTick,
		onDragStart,
		onDragMove,
		onDragOver,
		onDragCancel,
		onDragEnd,
	};
};
