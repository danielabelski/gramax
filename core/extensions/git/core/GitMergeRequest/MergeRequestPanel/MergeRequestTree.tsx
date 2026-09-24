import { DiffStatusIndicator } from "@ext/git/core/Diff/components/Changes/DiffStatusIndicator";
import type { DiffTreeItem } from "@ext/git/core/Diff/components/Changes/diffTreeItems";
import { buildDiffTreeItems } from "@ext/git/core/Diff/components/Changes/diffTreeItems";
import type { DiffFlattenTreeAnyItem } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import { PublishFileMeta } from "@ext/git/core/GitPublish/PublishPanel/components/PublishFileMeta";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flattenTreeItems, TREE_ROW_HEIGHT, TreeIcon, TreeMeta, TreeRow, TreeTitle, TreeTrailing } from "@ui-kit/Tree";
import { useMemo } from "react";

const MergeRequestTreeRow = ({
	item,
	depth,
	onOpen,
}: {
	item: DiffTreeItem;
	depth: number;
	onOpen: (entry: DiffFlattenTreeAnyItem) => void;
}) => {
	const isGroup = item.variant === "group";
	const overview = item.entry.type === "node" ? null : item.entry.overview;

	return (
		<TreeRow
			depth={depth}
			isGroup={isGroup}
			item={item}
			onClick={isGroup ? undefined : () => onOpen(item.entry)}
			titleOffset={8}
		>
			{item.accentColor && overview && <DiffStatusIndicator color={item.accentColor} status={overview.status} />}
			<TreeIcon icon={item.icon} />
			<TreeTitle>{item.title}</TreeTitle>
			{overview && (
				<TreeTrailing>
					<TreeMeta>
						<PublishFileMeta overview={overview} />
					</TreeMeta>
				</TreeTrailing>
			)}
		</TreeRow>
	);
};

export const MergeRequestTree = ({
	entries,
	onOpen,
	scrollElement,
}: {
	entries: DiffFlattenTreeAnyItem[];
	onOpen: (entry: DiffFlattenTreeAnyItem) => void;
	scrollElement?: HTMLElement | null;
}) => {
	const { items } = useMemo(() => buildDiffTreeItems(entries), [entries]);
	const rows = useMemo(() => flattenTreeItems(items), [items]);
	const virtualizer = useVirtualizer({
		count: rows.length,
		estimateSize: () => TREE_ROW_HEIGHT,
		getItemKey: (index) => rows[index].item.id,
		getScrollElement: () => scrollElement ?? null,
		overscan: 8,
	});

	return (
		<div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
			{virtualizer.getVirtualItems().map((virtualRow) => {
				const { item, depth } = rows[virtualRow.index];

				return (
					<div
						className="absolute left-0 top-0 w-full"
						key={virtualRow.key}
						style={{
							height: virtualRow.size,
							transform: `translateY(${virtualRow.start}px)`,
						}}
					>
						<MergeRequestTreeRow depth={depth} item={item} onOpen={onOpen} />
					</div>
				);
			})}
		</div>
	);
};
