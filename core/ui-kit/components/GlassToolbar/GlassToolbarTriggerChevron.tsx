import { cn } from "@core-ui/utils/cn";
import { GlassToolbarTriggerChevron as UiKitToolbarTriggerChevron } from "ics-ui-kit/components/glass-toolbar";
import { forwardRef, useCallback } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";

type UiKitToolbarTriggerChevronProps = ExtractComponentGeneric<typeof UiKitToolbarTriggerChevron> & {
	focusable?: boolean;
	active?: boolean;
};

export const GlassToolbarTriggerChevron = forwardRef<HTMLButtonElement, UiKitToolbarTriggerChevronProps>(
	(props, ref) => {
		const { className, focusable, active, onClick, onMouseDown, ...otherProps } = props;

		// For don't lose focus in editor when clicking on toolbar toggle button
		const handleClick = useCallback(
			(e: React.MouseEvent<HTMLButtonElement>) => {
				if (!focusable) e.preventDefault();
				onClick?.(e);
			},
			[onClick, focusable],
		);

		// For don't lose focus in editor when touching on toolbar toggle button
		// mousedown fires before focus transfer and is not passive, unlike touchstart
		const handleMouseDown = useCallback(
			(e: React.MouseEvent<HTMLButtonElement>) => {
				if (!focusable) e.preventDefault();
				onMouseDown?.(e);
			},
			[onMouseDown, focusable],
		);

		return (
			<UiKitToolbarTriggerChevron
				aria-selected={active}
				className={cn(
					"disabled:opacity-50 disabled:pointer-events-none hover:bg-alpha-high-90 data-[state=on]:bg-alpha-high-80",
					className,
				)}
				onClick={handleClick}
				onMouseDown={handleMouseDown}
				ref={ref}
				{...otherProps}
			/>
		);
	},
);
