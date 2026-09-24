import { cn } from "@core-ui/utils/cn";
import { Badge } from "@ui-kit/Badge";
import { Icon } from "@ui-kit/Icon";

export type PullPushCounterProps = {
	pullCounter: number;
	pushCounter: number;
};

const PullPushCounter = ({ pullCounter, pushCounter }: PullPushCounterProps) => {
	const showPullCounter = pullCounter > 0;
	const showPushCounter = pushCounter > 0;

	if (!showPushCounter && !showPullCounter) return null;

	return (
		<div className="flex items-center h-4">
			{showPullCounter && (
				<Badge className={cn("gap-0 px-1", showPushCounter && "-mr-1")} size="sm">
					<Icon className="text-secondary-fg" icon="arrow-down" size="sm" />
					{pullCounter}
				</Badge>
			)}
			{showPushCounter && (
				<Badge className="gap-0 px-1" focus="high" size="sm">
					<Icon className="text-primary-bg" icon="arrow-up" size="sm" />
					{pushCounter}
				</Badge>
			)}
		</div>
	);
};

export default PullPushCounter;
