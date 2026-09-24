import { cn } from "@core-ui/utils/cn";
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from "@ui-kit/Tooltip";
import { GlassToolbarButton as UiKitGlassToolbarButton } from "ics-ui-kit/components/glass-toolbar";
import { forwardRef, useCallback } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";

type UiKitGlassToolbarButtonProps = ExtractComponentGeneric<typeof UiKitGlassToolbarButton>;

export interface GlassToolbarButtonProps extends UiKitGlassToolbarButtonProps {
	tooltipText?: string;
	hotKey?: string;
	focusable?: boolean;
}

export const GlassToolbarButton = forwardRef<HTMLButtonElement, GlassToolbarButtonProps>((props, ref) => {
	const { tooltipText, hotKey, focusable, onClick, onTouchStart, className, ...otherProps } = props;

	// For don't lose focus in editor when clicking on toolbar button
	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			if (!focusable) e.preventDefault();
			onClick?.(e);
		},
		[onClick, focusable],
	);

	// For don't lose focus in editor when clicking on toolbar button
	const handleTouchStart = useCallback(
		(e: React.TouchEvent<HTMLButtonElement>) => {
			if (!focusable) e.preventDefault();
			onTouchStart?.(e);
		},
		[onTouchStart, focusable],
	);

	const button = (
		<UiKitGlassToolbarButton
			ref={ref}
			{...otherProps}
			className={cn(
				"disabled:pointer-events-none disabled:opacity-50 hover:bg-alpha-high-90 data-[state=on]:bg-alpha-high-80",
				className,
			)}
			onClick={handleClick}
			onTouchStart={handleTouchStart}
		/>
	);

	if (!tooltipText && !hotKey) return button;

	return (
		<Tooltip>
			<TooltipContent sideOffset={2}>
				<div className="flex items-center gap-2">
					{tooltipText}
					{hotKey && <TooltipShortcut className="p-0" inverse value={hotKey} />}
				</div>
			</TooltipContent>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
		</Tooltip>
	);
});
