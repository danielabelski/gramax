import { cn } from "@core-ui/utils/cn";
import { Checkbox } from "@ui-kit/Checkbox";
import { Icon, type IconCode } from "@ui-kit/Icon";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { type ComponentProps, forwardRef, type ReactNode } from "react";
import { useTreeRow } from "./TreeRowContext";

export const TreeIndicator = ({ className, ...props }: ComponentProps<"span">) => (
	<span className={cn("absolute left-0 flex", className)} {...props} />
);

export const TreeIndicatorBar = forwardRef<HTMLSpanElement, Omit<ComponentProps<"span">, "color"> & { color: string }>(
	({ color, className, style, ...props }, ref) => (
		<span
			className={cn("h-4 w-0.5 rounded-full", className)}
			data-testid="tree-indicator-bar"
			ref={ref}
			style={{ ...style, backgroundColor: color }}
			{...props}
		/>
	),
);
TreeIndicatorBar.displayName = "TreeIndicatorBar";

export const TreeCheckbox = ({ className }: { className?: string }) => {
	const { isSelected, onSelect } = useTreeRow();
	if (!onSelect) return null;

	return (
		<Checkbox
			checked={isSelected}
			className={cn("absolute left-2 !shadow-none", className)}
			onCheckedChange={onSelect}
			onClick={(event) => event.stopPropagation()}
			size="sm"
		/>
	);
};

export const TreeIcon = ({ icon, className }: { icon?: IconCode; className?: string }) =>
	icon ? <Icon className={cn("shrink-0", className)} icon={icon} /> : null;

export const TreeTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
	<TextOverflowTooltip className={cn("truncate text-sm", className)}>{children}</TextOverflowTooltip>
);

export const TreeSpacer = ({ className }: { className?: string }) => <div className={cn("ml-auto", className)} />;

export const TreeTrailing = ({ children, className }: { children?: ReactNode; className?: string }) =>
	children ? <div className={cn("ml-auto flex items-center", className)}>{children}</div> : null;

export const TreeMeta = ({ children, className }: { children?: ReactNode; className?: string }) =>
	children ? <div className={cn("flex items-center", className)}>{children}</div> : null;

export const TreeActions = ({ children, className }: { children?: ReactNode; className?: string }) =>
	children ? (
		<div
			className={cn(
				"flex w-0 items-center justify-end overflow-hidden opacity-0 transition-[width,padding-left,opacity] duration-100 ease-in-out group-hover:w-8 group-hover:pl-2 group-hover:opacity-100",
				className,
			)}
		>
			{children}
		</div>
	) : null;
