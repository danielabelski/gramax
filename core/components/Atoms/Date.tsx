import type { TooltipDelayTier } from "@core-ui/timings";
import DateUtils, { type DateType } from "@core-ui/utils/dateUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";

interface DateProps {
	date: DateType;
	tooltipDelay?: TooltipDelayTier;
	className?: string;
}

const Date = ({ date, className, tooltipDelay }: DateProps) => {
	const relativeDate = DateUtils.getRelativeDateTime(date);
	const dateViewModel = DateUtils.getDateViewModel(date);
	return (
		<Tooltip delay={tooltipDelay}>
			<TooltipTrigger asChild>
				<span className={className}>{relativeDate}</span>
			</TooltipTrigger>
			<TooltipContent>{dateViewModel}</TooltipContent>
		</Tooltip>
	);
};

export default Date;
