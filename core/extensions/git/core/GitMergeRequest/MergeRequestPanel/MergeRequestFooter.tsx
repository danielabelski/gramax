import type { MergeRequestStatus } from "@ext/git/core/GitMergeRequest/components/Elements/Status";
import MergeButton from "@ext/git/core/GitMergeRequest/components/MergeButton";
import type { MergeRequest } from "@ext/git/core/GitMergeRequest/model/MergeRequest";
import { MergeRequestApprovers } from "./MergeRequestApprovers";

export const MergeRequestFooter = ({
	mergeRequest,
	pathnames,
	status,
}: {
	mergeRequest: MergeRequest;
	pathnames: string[];
	status: MergeRequestStatus;
}) => (
	<div className="shrink-0 space-y-4">
		<MergeRequestApprovers approvers={mergeRequest.approvers} pathnames={pathnames} />
		<div className="px-2 [&>div]:w-full [&_button]:w-full">
			<MergeButton hasConflicts={false} mergeRequest={mergeRequest} status={status} />
		</div>
	</div>
);
