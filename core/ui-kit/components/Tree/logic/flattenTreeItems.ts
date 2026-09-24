import type { TreeItem } from "../types";

export type FlatTreeRow<TItem> = {
	item: TItem;
	depth: number;
};

export const flattenTreeItems = <TItem extends TreeItem>(items: TItem[], depth = 0): FlatTreeRow<TItem>[] =>
	items.flatMap((item) => [{ item, depth }, ...flattenTreeItems((item.children ?? []) as TItem[], depth + 1)]);
