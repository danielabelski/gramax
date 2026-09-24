import getMrStatus from "@ext/git/core/GitMergeRequest/logic/getMrStatus";
import { MergeRequestChanges } from "@ext/git/core/GitMergeRequest/MergeRequestPanel/MergeRequestChanges";
import { MergeRequestFooter } from "@ext/git/core/GitMergeRequest/MergeRequestPanel/MergeRequestFooter";
import { MergeRequestSummary } from "@ext/git/core/GitMergeRequest/MergeRequestPanel/MergeRequestSummary";
import type { MergeRequest } from "@ext/git/core/GitMergeRequest/model/MergeRequest";
import { Divider } from "@ui-kit/Divider";
import { useMemo, useState } from "react";

export type MergeRequestProps = {
	mergeRequest: MergeRequest;
	isDraft: boolean;
};

const MergeRequestTab = ({ mergeRequest, isDraft }: MergeRequestProps) => {
	const [diffPathnames, setDiffPathnames] = useState<string[]>([]);
	const status = useMemo(() => getMrStatus(mergeRequest, isDraft), [mergeRequest, isDraft]);

	return (
		<div className="flex min-h-0 flex-1 flex-col space-y-3 pb-2 text-primary-fg">
			<MergeRequestSummary mergeRequest={mergeRequest} status={status} />

			<MergeRequestChanges onPathnamesChange={setDiffPathnames} targetRef={mergeRequest.targetBranchRef} />

			<Divider className="border-secondary-border shrink-0" />

			<MergeRequestFooter mergeRequest={mergeRequest} pathnames={diffPathnames} status={status} />
		</div>
	);
};

export default MergeRequestTab;
