import { defaultRangeExtractor, observeElementOffset, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type ScrollToAlign = "auto" | "start" | "center" | "end";

export type VirtualListOptions<T> = {
	items: T[];
	getItemKey: (item: T) => string;
	estimateSize: (index: number) => number;
	getScrollElement: () => HTMLElement | null;
	scrollToKey?: string;
	scrollToAlign?: ScrollToAlign;
	pinnedKeys?: string[];
};

const observeOffset: typeof observeElementOffset<HTMLElement> = (instance, callback) => {
	let frame: number | null = null;
	const cleanup = observeElementOffset(instance, (offset, scrolling) => {
		if (frame !== null) cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			frame = null;
			callback(offset, scrolling);
		});
	});
	return () => {
		cleanup?.();
		if (frame !== null) cancelAnimationFrame(frame);
	};
};

export const useVirtualList = <T>({
	items,
	getItemKey,
	estimateSize,
	getScrollElement,
	scrollToKey,
	scrollToAlign = "auto",
	pinnedKeys,
	getItemKeys,
}: VirtualListOptions<T> & { getItemKeys?: (item: T) => string[] }) => {
	const listRef = useRef<HTMLDivElement>(null);
	const [scrollMargin, setScrollMargin] = useState<number | null>(null);
	const [interactedKey, setInteractedKey] = useState<string>();
	const revealedKey = useRef<string>();
	const indexes = useMemo(() => {
		const indexes = new Map<string, number>();
		items.forEach((item, index) => {
			for (const key of getItemKeys ? getItemKeys(item) : [getItemKey(item)]) indexes.set(key, index);
		});
		return indexes;
	}, [items, getItemKey, getItemKeys]);
	const getKey = useCallback((index: number) => getItemKey(items[index]), [items, getItemKey]);
	const rangeExtractor = useCallback<typeof defaultRangeExtractor>(
		(range) => {
			const indexesInRange = new Set(defaultRangeExtractor(range));
			for (const key of [...(pinnedKeys ?? []), interactedKey]) {
				const index = indexes.get(key);
				if (index !== undefined) indexesInRange.add(index);
			}
			return [...indexesInRange].sort((a, b) => a - b);
		},
		[indexes, pinnedKeys, interactedKey],
	);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement,
		getItemKey: getKey,
		estimateSize,
		scrollMargin: scrollMargin ?? 0,
		overscan: 8,
		rangeExtractor,
		observeElementOffset: observeOffset,
		useAnimationFrameWithResizeObserver: true,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: row sizes may change with the tree or the root font size
	useLayoutEffect(() => virtualizer.measure(), [estimateSize, virtualizer]);

	useEffect(() => {
		const list = listRef.current;
		const scrollElement = getScrollElement();
		if (!list || !scrollElement) return;
		const measure = () => {
			const top = list.getBoundingClientRect().top;
			const scrollTop = scrollElement.getBoundingClientRect().top;
			const offset = top - scrollTop + scrollElement.scrollTop - scrollElement.clientTop;
			setScrollMargin((previous) => (previous === offset ? previous : offset));
		};
		measure();
		let frame: number | null = null;
		const observer = new ResizeObserver(() => {
			if (frame !== null) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		});
		if (list.parentElement) observer.observe(list.parentElement);
		return () => {
			observer.disconnect();
			if (frame !== null) cancelAnimationFrame(frame);
		};
	}, [getScrollElement]);

	useLayoutEffect(() => {
		if (!scrollToKey) {
			revealedKey.current = undefined;
			return;
		}
		if (scrollMargin === null || revealedKey.current === scrollToKey || !virtualizer.scrollElement) return;
		const index = indexes.get(scrollToKey);
		if (index === undefined) return;
		const frame = requestAnimationFrame(() => {
			const needsReveal = virtualizer.getOffsetForIndex(index, "auto")?.[1] !== "auto";
			if (needsReveal) virtualizer.scrollToIndex(index, { align: scrollToAlign });
			revealedKey.current = scrollToKey;
		});
		return () => cancelAnimationFrame(frame);
	}, [scrollToKey, scrollToAlign, indexes, virtualizer, scrollMargin]);

	return { listRef, virtualizer, scrollMargin: scrollMargin ?? 0, setInteractedKey, interactedKey };
};
