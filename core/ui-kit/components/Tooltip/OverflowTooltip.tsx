import { cn } from "@core-ui/utils/cn";
import { useOverflowTooltip } from "ics-ui-kit/components/overflow-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "ics-ui-kit/components/tooltip";
import { useBoundaryDistance } from "./useBoundaryDistance";

type Side = NonNullable<React.ComponentPropsWithoutRef<typeof TooltipContent>["side"]>;

type Align = NonNullable<React.ComponentPropsWithoutRef<typeof TooltipContent>["align"]>;

/** Mirrors the ui-kit `TooltipContent` default, needed to add the measured distance on top of it. */
const DEFAULT_SIDE_OFFSET = 8;

export type OverflowTooltipProps = {
	children: React.ReactNode;
	triggerTag?: React.ElementType;
	className?: string;
	tooltipClassName?: string;
	side?: Side;
	align?: Align;
	focus?: "high";
	sideOffset?: number;
	offsetBoundarySelector?: string;
};

export const OverflowTooltip = ({
	children,
	className,
	focus,
	triggerTag,
	tooltipClassName,
	side,
	align,
	sideOffset,
	offsetBoundarySelector,
}: OverflowTooltipProps) => {
	const { open, onOpenChange, ref } = useOverflowTooltip<HTMLDivElement>();
	const boundaryDistance = useBoundaryDistance(ref, offsetBoundarySelector, open && side === "right");
	const TriggerTag = triggerTag || "span";

	return (
		<Tooltip onOpenChange={onOpenChange} open={open}>
			<TooltipTrigger asChild>
				<TriggerTag className={cn(className)} ref={ref}>
					{children}
				</TriggerTag>
			</TooltipTrigger>
			<TooltipContent
				align={align}
				className={cn("max-w-xs", tooltipClassName)}
				focus={focus}
				side={side}
				sideOffset={boundaryDistance ? (sideOffset ?? DEFAULT_SIDE_OFFSET) + boundaryDistance : sideOffset}
			>
				{children}
			</TooltipContent>
		</Tooltip>
	);
};

OverflowTooltip.displayName = "OverflowTooltip";
