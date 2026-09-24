import { cn } from "@core-ui/utils/cn";
import { Fragment, type ReactNode, useMemo } from "react";
import { flattenTreeItems } from "./logic/flattenTreeItems";
import type { TreeItem } from "./types";

export const TREE_INDENT_STEP = 12;
export const TREE_TITLE_OFFSET = 28;
export const TREE_ROW_HEIGHT = 28;

export type TreeProps<TItem extends TreeItem> = {
	items: TItem[];
	children: (row: { item: TItem; depth: number }) => ReactNode;
	className?: string;
};

export const Tree = <TItem extends TreeItem>({ items, children, className }: TreeProps<TItem>) => {
	const rows = useMemo(() => flattenTreeItems(items), [items]);

	return (
		<div className={cn("w-full", className)}>
			{rows.map((row) => (
				<Fragment key={row.item.id}>{children(row)}</Fragment>
			))}
		</div>
	);
};
