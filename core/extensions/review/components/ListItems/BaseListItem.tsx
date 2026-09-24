import { cn } from "@core-ui/utils/cn";
import { MenuItem } from "@ui-kit/MenuItem";
import type { HTMLAttributes } from "react";

export interface BaseListItemProps extends HTMLAttributes<HTMLDivElement> {
	accentClassName?: string;
}

export const BaseListItem = ({ children, accentClassName, className, ...props }: BaseListItemProps) => {
	return (
		<MenuItem
			className={cn(
				"group/review relative flex w-full min-w-0 items-start gap-2 rounded-lg bg-transparent px-2 py-2 hover:bg-secondary-border",
				accentClassName,
				className,
			)}
			{...props}
		>
			{children}
		</MenuItem>
	);
};
