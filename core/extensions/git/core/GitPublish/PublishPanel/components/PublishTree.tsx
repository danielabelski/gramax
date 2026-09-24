import { buildDiffTreeItems } from "@ext/git/core/Diff/components/Changes/diffTreeItems";
import type { DiffFlattenTreeAnyItem } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flattenTreeItems, TREE_ROW_HEIGHT } from "@ui-kit/Tree";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { findScrollParent } from "./findScrollParent";
import { PublishTreeRow } from "./PublishTreeRow";

export type PublishTreeProps = {
	entries: DiffFlattenTreeAnyItem[];
	activePath?: string;
	canDiscard: boolean;
	isSelected: (entry: DiffFlattenTreeAnyItem) => boolean;
	onSelect: (entry: DiffFlattenTreeAnyItem, checked: boolean) => void;
	onOpen: (entry: DiffFlattenTreeAnyItem) => void;
	onDiscard: (entry: DiffFlattenTreeAnyItem) => void;
};

export const PublishTree = ({
	entries,
	activePath,
	canDiscard,
	isSelected,
	onSelect,
	onOpen,
	onDiscard,
}: PublishTreeProps) => {
	const listRef = useRef<HTMLDivElement>(null);
	const [scrollElement, setScrollElement] = useState<HTMLElement>(null);
	const [scrollMargin, setScrollMargin] = useState(0);
	const { items } = useMemo(() => buildDiffTreeItems(entries), [entries]);
	const rows = useMemo(() => flattenTreeItems(items), [items]);

	useLayoutEffect(() => {
		const element = findScrollParent(listRef.current);
		setScrollElement(element);
		setScrollMargin(
			listRef.current && element
				? listRef.current.getBoundingClientRect().top - element.getBoundingClientRect().top + element.scrollTop
				: 0,
		);
	}, []);

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollElement,
		getItemKey: (index) => rows[index].item.id,
		estimateSize: () => TREE_ROW_HEIGHT,
		overscan: 8,
		scrollMargin,
	});

	return (
		<div className="relative w-full" ref={listRef} style={{ height: virtualizer.getTotalSize() }}>
			{virtualizer.getVirtualItems().map((virtualRow) => {
				const { item, depth } = rows[virtualRow.index];

				return (
					<div
						className="absolute left-0 top-0 w-full"
						key={virtualRow.key}
						style={{
							height: virtualRow.size,
							transform: `translateY(${virtualRow.start - scrollMargin}px)`,
						}}
					>
						<PublishTreeRow
							canDiscard={canDiscard}
							depth={depth}
							isActive={item.id === activePath}
							isSelected={isSelected}
							item={item}
							onDiscard={onDiscard}
							onOpen={onOpen}
							onSelect={onSelect}
						/>
					</div>
				);
			})}
		</div>
	);
};
