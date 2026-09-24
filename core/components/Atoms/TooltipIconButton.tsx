import { IconButton, type IconButtonProps } from "@ui-kit/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";

type Side = NonNullable<React.ComponentPropsWithoutRef<typeof TooltipContent>["side"]>;

export interface TooltipIconButtonProps extends IconButtonProps {
	tooltip: string;
	tooltipSide?: Side;
}

export const TooltipIconButton = (props: TooltipIconButtonProps) => {
	const { tooltip, tooltipSide, ...otherProps } = props;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<IconButton {...otherProps} />
			</TooltipTrigger>
			<TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
		</Tooltip>
	);
};
