import t from "@ext/localization/locale/translate";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ui-kit/Tooltip";
import { TreeIndicator, TreeIndicatorBar } from "@ui-kit/Tree";

const STATUS_LABELS = {
	[FileStatus.new]: "diff.type.added",
	[FileStatus.delete]: "diff.type.deleted",
	[FileStatus.modified]: "diff.type.modified",
	[FileStatus.rename]: "diff.type.breadcrumb",
} as const;

export const DiffStatusIndicator = ({ color, status }: { color: string; status: FileStatus }) => {
	const labelKey = STATUS_LABELS[status];
	if (!labelKey) return null;

	const label = t(labelKey);

	return (
		<TreeIndicator className="top-0">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<span
							aria-label={label}
							className="flex h-7 w-2 items-center"
							data-testid="diff-status-indicator-trigger"
							role="img"
						>
							<TreeIndicatorBar color={color} />
						</span>
					</TooltipTrigger>
					<TooltipContent side="right">{label}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</TreeIndicator>
	);
};
