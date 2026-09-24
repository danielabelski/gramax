import type { Virtualizer } from "@tanstack/react-virtual";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { VirtualListOptions } from "./useVirtualList";
import {
	createDisclosure,
	type Disclosure,
	disclosureEntries,
	disclosureProgress,
	type ListEntry,
	rowEntries,
} from "./virtualListDisclosure";

export const useVirtualListDisclosure = <T>({
	items,
	getItemKey,
	estimateSize,
	scrollToKey,
	enabled,
}: Pick<VirtualListOptions<T>, "items" | "getItemKey" | "estimateSize" | "scrollToKey"> & { enabled: boolean }) => {
	const rows = useMemo(
		() =>
			items.map((item, index) => ({
				item,
				index,
				key: getItemKey(item),
				size: estimateSize(index),
			})),
		[items, getItemKey, estimateSize],
	);
	const [state, setState] = useState(() => ({
		rows,
		enabled,
		scrollToKey,
		disclosure: null as Disclosure<T> | null,
		entries: rowEntries(rows),
	}));
	if (state.rows !== rows || state.enabled !== enabled || state.scrollToKey !== scrollToKey) {
		const animate =
			enabled &&
			state.enabled &&
			state.scrollToKey === scrollToKey &&
			!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const unchanged =
			rows.length === state.rows.length &&
			rows.every((row, index) => row.key === state.rows[index].key && row.size === state.rows[index].size);
		const disclosure = animate
			? unchanged
				? state.disclosure
				: createDisclosure(state.rows, rows, state.disclosure)
			: null;
		setState({
			rows,
			enabled,
			scrollToKey,
			disclosure,
			entries: disclosure ? disclosureEntries(rows, disclosure) : rowEntries(rows),
		});
	}
	const finish = useCallback(
		(disclosure: Disclosure<T>) =>
			setState((current) =>
				current.disclosure === disclosure
					? { ...current, disclosure: null, entries: rowEntries(current.rows) }
					: current,
			),
		[],
	);
	return { entries: state.entries, disclosure: state.disclosure, finish };
};

export const getEntryKey = <T>(entry: ListEntry<T>) => entry.key;
export const getEntryItemKeys = <T>(entry: ListEntry<T>) =>
	entry.type === "row" ? [entry.row.key] : entry.rows.map((row) => row.key);
export const getEntrySize = <T>(entry: ListEntry<T>) => (entry.type === "row" ? entry.row.size : entry.height.current);

export const useDisclosureAnimation = <T>(
	{ disclosure, finish }: ReturnType<typeof useVirtualListDisclosure<T>>,
	virtualizer: Virtualizer<HTMLElement, Element>,
	onAnimationEnd?: () => void,
) => {
	const onEnd = useRef(onAnimationEnd);
	onEnd.current = onAnimationEnd;
	useLayoutEffect(() => {
		if (!disclosure) return;
		const adjustScroll = virtualizer.shouldAdjustScrollPositionOnItemSizeChange;
		virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false;
		disclosure.height.current = disclosure.from;
		virtualizer.resizeItem(disclosure.index, disclosure.from);
		const started = performance.now();
		const tick = (now: number) => {
			const progress = Math.min(1, (now - started) / 200);
			const size = disclosure.from + (disclosure.to - disclosure.from) * disclosureProgress(progress);
			disclosure.height.current = size;
			virtualizer.resizeItem(disclosure.index, size);
			if (progress < 1) frame = requestAnimationFrame(tick);
			else {
				finish(disclosure);
				onEnd.current?.();
			}
		};
		let frame = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(frame);
			virtualizer.shouldAdjustScrollPositionOnItemSizeChange = adjustScroll;
		};
	}, [disclosure, finish, virtualizer]);
};
