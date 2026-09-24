import { createContext, useContext } from "react";
import type { TreeItem } from "./types";

export type TreeRowContextValue<TItem extends TreeItem> = {
	item: TItem;
	isSelected?: boolean;
	onSelect?: (checked: boolean) => void;
};

export const TreeRowContext = createContext<TreeRowContextValue<TreeItem> | null>(null);

export const useTreeRow = <TItem extends TreeItem>() => {
	const context = useContext(TreeRowContext);
	if (!context) throw new Error("Tree row primitives must be rendered inside TreeRow");
	return context as TreeRowContextValue<TItem>;
};
