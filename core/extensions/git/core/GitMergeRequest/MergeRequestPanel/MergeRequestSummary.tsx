import Date from "@components/Atoms/Date";
import { cn } from "@core-ui/utils/cn";
import type { MergeRequestStatus } from "@ext/git/core/GitMergeRequest/components/Elements/Status";
import type { MergeRequest } from "@ext/git/core/GitMergeRequest/model/MergeRequest";
import t from "@ext/localization/locale/translate";
import { Badge } from "@ui-kit/Badge";
import { Icon } from "@ui-kit/Icon";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { MergeRequestBranch } from "./MergeRequestBranch";

const STATUS_CLASS = {
	draft: "border-secondary-border text-muted",
	"in-progress": "border-status-warning-primary-border text-status-warning-fg",
	approved: "border-status-success-primary-border text-status-success-fg",
} as const;

export const MergeRequestSummary = ({
	mergeRequest,
	status,
}: {
	mergeRequest: MergeRequest;
	status: MergeRequestStatus;
}) => {
	const badge = (
		<Badge className={cn("shrink-0 h-4", STATUS_CLASS[status])} size="sm">
			{t(`git.merge-requests.status.${status}`)}
		</Badge>
	);
	return (
		<div className="mx-2 shrink-0 rounded-lg bg-secondary-border px-3 py-2">
			{mergeRequest.description && (
				<div className="flex min-w-0 items-center justify-between gap-2">
					<TextOverflowTooltip className="min-w-0 flex-1 text-xs font-semibold">
						{mergeRequest.description}
					</TextOverflowTooltip>
					{badge}
				</div>
			)}
			<div className="flex items-center gap-1 text-xs text-muted">
				<TextOverflowTooltip className="min-w-0">
					{mergeRequest.creator?.name || mergeRequest.creator?.email}
				</TextOverflowTooltip>
				<span>·</span>
				<Date date={mergeRequest.createdAt?.toString()} />
				{!mergeRequest.description ? badge : null}
			</div>
			<div className="pt-2 pb-1 flex items-center gap-1.5">
				<MergeRequestBranch name={mergeRequest.sourceBranchRef} />
				<Icon className="size-3.5 shrink-0 text-muted" icon="arrow-right" />
				<MergeRequestBranch name={mergeRequest.targetBranchRef} />
			</div>
		</div>
	);
};
