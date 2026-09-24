import { TextOverflowTooltip } from "@ui-kit/Tooltip";

export const MergeRequestBranch = ({ name }: { name: string }) => (
	<TextOverflowTooltip className="h-5 min-w-0 flex-1 rounded-full bg-primary-bg px-3 text-center text-xs font-medium leading-5">
		{name}
	</TextOverflowTooltip>
);
