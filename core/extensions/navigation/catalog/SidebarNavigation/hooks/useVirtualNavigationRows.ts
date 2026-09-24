import { type RefObject, useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useNavigationTreeStore } from "../store/navigationTreeStore";
import { flattenNavigationRows } from "../utils/flattenNavigationRows";

export const useVirtualNavigationRows = (containerRef: RefObject<HTMLDivElement>) => {
	const { rootIds, childrenMap, expanded, selectedId, draggingId, isDragLocked, scope, notifyLayoutSettled } =
		useNavigationTreeStore((s) => ({
			rootIds: s.rootIds,
			childrenMap: s.childrenMap,
			expanded: s.expanded,
			selectedId: s.selectedId,
			draggingId: s.draggingId,
			isDragLocked: s.isDragLocked,
			scope: s.scope,
			notifyLayoutSettled: s.notifyLayoutSettled,
		}));
	const rows = useMemo(() => flattenNavigationRows(rootIds, childrenMap, expanded), [rootIds, childrenMap, expanded]);
	const [rem, setRem] = useState(16);
	const getScrollElement = useCallback(
		() => containerRef.current?.closest<HTMLElement>('[data-sidebar="content"]') ?? null,
		[containerRef],
	);
	const estimateSize = useCallback(
		(index: number) => (rows[index].level === 1 && index > 0 ? 2.625 : 1.875) * rem,
		[rows, rem],
	);
	const pinnedKeys = useMemo(() => (draggingId ? [draggingId] : []), [draggingId]);

	useLayoutEffect(() => {
		setRem(Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: expansion and reordering move the drop targets
	useLayoutEffect(() => notifyLayoutSettled(), [rows, notifyLayoutSettled]);

	return {
		rows,
		estimateSize,
		getScrollElement,
		pinnedKeys,
		selectedId,
		scope,
		notifyLayoutSettled,
		animateChanges: !draggingId && !isDragLocked,
	};
};
