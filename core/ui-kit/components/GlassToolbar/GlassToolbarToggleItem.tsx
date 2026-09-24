import { cn } from "@core-ui/utils/cn";
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from "@ui-kit/Tooltip";
import { GlassToolbarToggleItem as UiKitToolbarToggleItem } from "ics-ui-kit/components/glass-toolbar";
import { forwardRef, useCallback } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";

type UiKitToolbarToggleItemProps = ExtractComponentGeneric<typeof UiKitToolbarToggleItem>;

export interface GlassToolbarToggleItemProps extends UiKitToolbarToggleItemProps {
	active?: boolean;
	tooltipText?: string;
	hotKey?: string;
	focusable?: boolean;
}

export const GlassToolbarToggleItem = forwardRef<HTMLButtonElement, GlassToolbarToggleItemProps>((props, ref) => {
	const { tooltipText, hotKey, active, focusable, onClick, onTouchStart, className, ...otherProps } = props;
	const state = active ? "on" : "off";

	// For don't lose focus in editor when clicking on toolbar toggle button
	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			if (!focusable) e.preventDefault();
			onClick?.(e);
		},
		[onClick, focusable],
	);

	// For don't lose focus in editor when clicking on toolbar toggle button
	const handleTouchStart = useCallback(
		(e: React.TouchEvent<HTMLButtonElement>) => {
			if (!focusable) e.preventDefault();
			onTouchStart?.(e);
		},
		[onTouchStart, focusable],
	);

	const item = (
		<UiKitToolbarToggleItem
			ref={ref}
			{...otherProps}
			className={cn(
				"disabled:pointer-events-none disabled:opacity-50 hover:bg-alpha-high-90 data-[state=on]:bg-alpha-high-80",
				className,
			)}
			data-state={state}
			onClick={handleClick}
			onTouchStart={handleTouchStart}
		/>
	);

	if (!tooltipText && !hotKey) return item;

	return (
		<Tooltip>
			{(hotKey || tooltipText) && (
				<TooltipContent sideOffset={2}>
					<div className="flex items-center gap-2">
						{tooltipText}
						{hotKey && <TooltipShortcut className="p-0" inverse value={hotKey} />}
					</div>
				</TooltipContent>
			)}
			<TooltipTrigger asChild>{item}</TooltipTrigger>
		</Tooltip>
	);
});
