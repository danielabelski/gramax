import { useCallback } from "react";
import { useVirtualList, type VirtualListOptions } from "./useVirtualList";
import {
	getEntryItemKeys,
	getEntryKey,
	getEntrySize,
	useDisclosureAnimation,
	useVirtualListDisclosure,
} from "./useVirtualListDisclosure";
import { disclosureWindow, type ListRow } from "./virtualListDisclosure";

type RenderRow<T> = { row: ListRow<T>; top: number; clipBottom?: number };

export const useAnimatedVirtualList = <T>(
	options: VirtualListOptions<T>,
	enabled: boolean,
	onAnimationEnd?: () => void,
) => {
	const disclosure = useVirtualListDisclosure({ ...options, enabled });
	const { entries } = disclosure;
	const estimateSize = useCallback((index: number) => getEntrySize(entries[index]), [entries]);
	const { listRef, virtualizer, scrollMargin, setInteractedKey, interactedKey } = useVirtualList({
		...options,
		items: entries,
		getItemKey: getEntryKey,
		getItemKeys: getEntryItemKeys,
		estimateSize,
	});
	useDisclosureAnimation(disclosure, virtualizer, onAnimationEnd);
	const pinnedKeys = [...(options.pinnedKeys ?? []), ...(interactedKey ? [interactedKey] : [])];
	const scrollTop = virtualizer.scrollOffset ?? 0;
	const viewportHeight = virtualizer.scrollRect?.height ?? 0;
	const rows: RenderRow<T>[] = [];
	for (const item of virtualizer.getVirtualItems()) {
		const entry = entries[item.index];
		if (entry.type === "row") {
			rows.push({ row: entry.row, top: item.start - scrollMargin });
			continue;
		}
		for (const index of disclosureWindow(
			entry,
			item.size,
			scrollTop - item.start,
			scrollTop + viewportHeight - item.start,
			pinnedKeys,
		)) {
			const row = entry.rows[index];
			const offset = entry.offsets[index];
			rows.push({
				row,
				top: item.start - scrollMargin + offset,
				clipBottom: Math.min(row.size, Math.max(0, offset + row.size - item.size)),
			});
		}
	}
	return {
		listRef,
		rows,
		height: virtualizer.getTotalSize(),
		setInteractedKey,
		animating: disclosure.disclosure !== null,
	};
};
