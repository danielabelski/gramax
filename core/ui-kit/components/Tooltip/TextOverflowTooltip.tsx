import { cn } from "@core-ui/utils/cn";
import { OverflowTooltip, type OverflowTooltipProps } from "@ui-kit/Tooltip/OverflowTooltip";

type TextOverflowTooltipProps = OverflowTooltipProps & {
	children?: React.ReactNode;
	className?: string;
	tooltipClassName?: string;
};

export const TextOverflowTooltip = ({
	children,
	className,
	tooltipClassName,
	...otherProps
}: TextOverflowTooltipProps) => {
	return (
		<OverflowTooltip
			className={cn("inline-block max-w-full truncate", className)}
			focus="high"
			tooltipClassName={tooltipClassName}
			{...otherProps}
		>
			{children}
		</OverflowTooltip>
	);
};

TextOverflowTooltip.displayName = "TextOverflowTooltip";
