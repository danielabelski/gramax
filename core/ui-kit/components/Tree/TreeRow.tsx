import { cn } from "@core-ui/utils/cn";
import type { ReactNode } from "react";
import { TREE_INDENT_STEP, TREE_TITLE_OFFSET } from "./Tree";
import { TreeRowContext } from "./TreeRowContext";
import type { TreeItem } from "./types";

export type TreeRowProps<TItem extends TreeItem> = {
	item: TItem;
	depth: number;
	children?: ReactNode;
	indentStep?: number;
	titleOffset?: number;
	isGroup?: boolean;
	isActive?: boolean;
	isSelected?: boolean;
	onSelect?: (checked: boolean) => void;
	onClick?: () => void;
	className?: string;
};

export const TreeRow = <TItem extends TreeItem>({
	item,
	depth,
	children,
	indentStep = TREE_INDENT_STEP,
	titleOffset = TREE_TITLE_OFFSET,
	isGroup = false,
	isActive = false,
	isSelected,
	onSelect,
	onClick,
	className,
}: TreeRowProps<TItem>) => {
	const paddingLeft = titleOffset + depth * indentStep;

	return (
		<TreeRowContext.Provider value={{ item, isSelected, onSelect }}>
			<div
				className={cn(
					"group relative flex h-7 items-center gap-2 rounded-lg pr-2",
					isGroup ? "text-muted" : "hover:bg-primary-bg-hover",
					isActive && "bg-secondary-bg-hover",
					onClick && !isGroup && "cursor-pointer",
					className,
				)}
				data-depth={depth}
				data-qa={onClick && !isGroup ? "qa-clickable" : undefined}
				onClick={isGroup ? undefined : onClick}
				style={{ paddingLeft }}
			>
				{children}
			</div>
		</TreeRowContext.Provider>
	);
};
