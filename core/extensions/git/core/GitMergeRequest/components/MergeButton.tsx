import ArticleUpdaterService from "@components/Article/ArticleUpdater/ArticleUpdaterService";
import Tooltip from "@components/Atoms/Tooltip";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import BranchUpdaterService from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import type { MergeRequestStatus } from "@ext/git/core/GitMergeRequest/components/Elements/Status";
import type { MergeRequestConfirmProps } from "@ext/git/core/GitMergeRequest/components/MergeRequestConfirm";
import type { MergeRequest } from "@ext/git/core/GitMergeRequest/model/MergeRequest";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { useCallback } from "react";

export type MergeButtonProps = {
	mergeRequest: MergeRequest;
	status: MergeRequestStatus;
	hasConflicts: boolean;
};

const useIsMergeAvailable = ({ mergeRequest, status, hasConflicts }: MergeButtonProps) => {
	const pageProps = PageDataContextService.value;

	if (status === "draft") return { disabled: true, reason: t("git.merge-requests.disable-button-reason.draft") };
	if (status === "in-progress")
		return { disabled: true, reason: t("git.merge-requests.disable-button-reason.not-approved") };
	if (status === "approved" && hasConflicts)
		return { disabled: true, reason: t("git.merge-requests.disable-button-reason.has-conflicts") };

	if (mergeRequest.creator.email !== pageProps.user.info?.mail)
		return { disabled: true, reason: t("git.merge-requests.disable-button-reason.not-author") };

	return { disabled: false, reason: null };
};

const MergeButton = ({ mergeRequest, status }: MergeButtonProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;

	const { disabled, reason } = useIsMergeAvailable({ mergeRequest, status, hasConflicts: false });

	// biome-ignore lint/correctness/useExhaustiveDependencies: context service values can change between renders
	const startMerge = useCallback(async () => {
		const validateMergeUrl = apiUrlCreator.validateMerge();
		ModalToOpenService.setValue(ModalToOpen.Loading);
		const res = await FetchService.fetch(validateMergeUrl);
		ModalToOpenService.resetValue();
		if (!res.ok) return;

		const mergeUrl = apiUrlCreator.mergeRequestMerge(false);
		ModalToOpenService.setValue<MergeRequestConfirmProps>(ModalToOpen.MergeRequestConfirm, {
			sourceBranch: mergeRequest.sourceBranchRef,
			targetBranch: mergeRequest.targetBranchRef,
			deleteAfterMerge: mergeRequest.options?.deleteAfterMerge,
			squash: mergeRequest.options?.squash,
			onMergeClick: async () => {
				ModalToOpenService.setValue(ModalToOpen.Loading);
				await FetchService.fetch(mergeUrl);
				ModalToOpenService.resetValue();

				await BranchUpdaterService.updateBranch(apiUrlCreator);
				await ArticleUpdaterService.update(apiUrlCreator);
			},
		});
	}, [apiUrlCreator, mergeRequest]);

	const button = (
		<Button className="w-full" disabled={disabled} onClick={startMerge} size="md" variant="primary">
			{t("git.merge.branches")}
		</Button>
	);

	return disabled ? <Tooltip content={reason}>{button}</Tooltip> : button;
};

export default MergeButton;
