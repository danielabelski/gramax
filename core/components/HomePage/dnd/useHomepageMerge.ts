import type { DragMoveEvent, DragOverEvent } from "@dnd-kit/core";
import { useMemo, useRef, useState } from "react";
import type { HomeSections } from "../utils/homeLayoutTypes";
import type { ItemKind } from "./ids";
import type { DropIndicator } from "./types";

const MERGE_INSET = 0.3;
const MERGE_EDGE_TOLERANCE = 0.15;

const relCenterInOver = (event: DragOverEvent | DragMoveEvent): { relX: number; relY: number } | null => {
	const overRect = event.over?.rect;
	const activeRect = event.active.rect.current.translated;
	if (!overRect || !activeRect) return null;
	const centerX = activeRect.left + activeRect.width / 2;
	const centerY = activeRect.top + activeRect.height / 2;
	return { relX: (centerX - overRect.left) / overRect.width, relY: (centerY - overRect.top) / overRect.height };
};

type MergeLatch = { targetId: string; axis: "x" | "y"; side: "start" | "end" };
const inBand = (rel: number) => rel >= MERGE_INSET && rel <= 1 - MERGE_INSET;

export const createMergeDetector = () => {
	let latch: MergeLatch | null = null;

	return {
		reset(targetId?: string) {
			if (!targetId || latch?.targetId !== targetId) latch = null;
		},

		isMergeActive(event: DragOverEvent | DragMoveEvent, overId: string): boolean {
			const rel = relCenterInOver(event);
			if (!rel) return true;
			const { relX, relY } = rel;
			if (
				relX < -MERGE_EDGE_TOLERANCE ||
				relX > 1 + MERGE_EDGE_TOLERANCE ||
				relY < -MERGE_EDGE_TOLERANCE ||
				relY > 1 + MERGE_EDGE_TOLERANCE
			)
				return false;

			if (!latch || latch.targetId !== overId) {
				if (!inBand(relX) && !inBand(relY)) return false;
				const axis: "x" | "y" =
					inBand(relY) && !inBand(relX)
						? "x"
						: inBand(relX) && !inBand(relY)
							? "y"
							: Math.abs(relX - 0.5) >= Math.abs(relY - 0.5)
								? "x"
								: "y";
				const coord = axis === "x" ? relX : relY;
				latch = { targetId: overId, axis, side: coord < 0.5 ? "start" : "end" };
			}

			const along = latch.axis === "x" ? relX : relY;
			const perp = latch.axis === "x" ? relY : relX;
			const nearEntrySide = latch.side === "start" ? along <= 1 - MERGE_INSET : along >= MERGE_INSET;
			return inBand(perp) && nearEntrySide;
		},
	};
};

/**
 * Which item the drag is latched onto and what that latch means. `merging` is the target the drop would merge into;
 * `reordered-off` is the target the drag just left, locked out of merging until the drag moves to another one.
 * A target is never in both phases at once, so one latch describes them.
 */
type TargetLatch = { targetId: string; phase: "merging" | "reordered-off" };

/**
 * A reorder deferred by one frame, so the item that left a merge target animates instead of snapping. Kept apart
 * from `TargetLatch`: the frame scheduled for one target has to survive the drag latching onto the next one.
 */
type PendingExitReorder = { targetId: string; frame: number; updater: (prev: HomeSections) => HomeSections };

export const useHomepageMerge = ({
	applyReorder,
}: {
	applyReorder: (updater: (prev: HomeSections) => HomeSections) => void;
}) => {
	const detectorRef = useRef(createMergeDetector());
	const latchRef = useRef<TargetLatch | null>(null);
	const pendingExitReorderRef = useRef<PendingExitReorder | null>(null);
	const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);
	const [layoutAnimationTick, setLayoutAnimationTick] = useState(0);

	/**
	 * Every action reads and writes refs only, so `applyReorder` is their single dependency. Building them in one memo
	 * keeps the whole set identity-stable, which is what lets `useHomepageDnd` memoize its drag handlers.
	 */
	const actions = useMemo(() => {
		const cancelMergeExitReorderFrame = () => {
			const pending = pendingExitReorderRef.current;
			if (!pending) return;
			cancelAnimationFrame(pending.frame);
			pendingExitReorderRef.current = null;
		};

		const flushMergeExitReorder = () => {
			const pending = pendingExitReorderRef.current;
			if (!pending) return;
			cancelMergeExitReorderFrame();
			applyReorder(pending.updater);
			setLayoutAnimationTick((s) => s + 1);
		};

		const scheduleMergeExitReorder = (overId: string, updater: (prev: HomeSections) => HomeSections) => {
			cancelMergeExitReorderFrame();
			const frame = requestAnimationFrame(() => {
				pendingExitReorderRef.current = null;
				applyReorder(updater);
				setLayoutAnimationTick((s) => s + 1);
			});
			pendingExitReorderRef.current = { targetId: overId, frame, updater };
		};

		const reset = () => {
			cancelMergeExitReorderFrame();
			detectorRef.current.reset();
			latchRef.current = null;
			setDropIndicator(null);
		};

		/** Moving off a target releases its `reordered-off` lock, so it can be merged into again on a later pass. */
		const noteOverTarget = (overId: string) => {
			detectorRef.current.reset(overId);
			const latch = latchRef.current;
			if (latch?.phase === "reordered-off" && latch.targetId !== overId) latchRef.current = null;
		};

		const isMergeExitReorderTarget = (overId: string) => pendingExitReorderRef.current?.targetId === overId;

		const markMerging = (overId: string) => {
			latchRef.current = { targetId: overId, phase: "merging" };
		};

		/** Was the previous drag tick merging into `overId`? Clears the latch, so it only ever holds for one tick. */
		const takeExitedMerge = (overId: string) => {
			const latch = latchRef.current;
			if (latch?.phase !== "merging") return false;
			latchRef.current = null;
			return latch.targetId === overId;
		};

		const markReorderedOff = (overId: string) => {
			latchRef.current = { targetId: overId, phase: "reordered-off" };
		};

		const isReorderedOff = (overId: string) =>
			latchRef.current?.phase === "reordered-off" && latchRef.current.targetId === overId;

		const setMergeTarget = (targetType: ItemKind, targetId: string) =>
			setDropIndicator((prev) =>
				prev && prev.targetType === targetType && prev.targetId === targetId ? prev : { targetType, targetId },
			);

		const clearMergeTarget = () => setDropIndicator(null);

		return {
			cancelMergeExitReorderFrame,
			flushMergeExitReorder,
			isMergeExitReorderTarget,
			noteOverTarget,
			reset,
			isMergeActive: detectorRef.current.isMergeActive,
			markMerging,
			takeExitedMerge,
			markReorderedOff,
			isReorderedOff,
			scheduleMergeExitReorder,
			setMergeTarget,
			clearMergeTarget,
		};
	}, [applyReorder]);

	return { dropIndicator, layoutAnimationTick, actions };
};
