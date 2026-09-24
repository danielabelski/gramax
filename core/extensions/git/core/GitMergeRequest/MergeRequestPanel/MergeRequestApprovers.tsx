import Approver from "@ext/git/core/GitMergeRequest/components/Approval/Approver";
import type { ApprovalSignature } from "@ext/git/core/GitMergeRequest/model/MergeRequest";
import t from "@ext/localization/locale/translate";
import { useReviewerComments } from "@ext/markdown/elements/comment/edit/logic/stores/CommentsStore";

export const MergeRequestApprovers = ({
	approvers,
	pathnames,
}: {
	approvers: ApprovalSignature[];
	pathnames: string[];
}) => {
	const comments = useReviewerComments({ authors: approvers, pathnames });
	const approvedCount = approvers.filter((approver) => approver.approvedAt).length;

	return (
		<div className="px-2">
			<div className="mb-1 flex items-center justify-between px-2 text-xs font-medium text-muted py-1.5 pr-1.5">
				<span>{t("git.merge-requests.approvers")}</span>
				<span>
					{approvedCount}/{approvers.length}
				</span>
			</div>
			{approvers.length ? (
				approvers.map((approver) => (
					<Approver approver={approver} comments={comments[approver.email]?.total} key={approver.email} />
				))
			) : (
				<span className="text-sm text-muted">{t("git.merge-requests.no-approvers")}</span>
			)}
		</div>
	);
};
