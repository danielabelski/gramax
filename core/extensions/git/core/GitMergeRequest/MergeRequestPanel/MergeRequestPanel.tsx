import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { useApi } from "@core-ui/hooks/useApi";
import useIsOffline from "@ext/errorHandlers/hooks/useIsOffline";
import BranchUpdaterService from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import OnBranchUpdateCaller from "@ext/git/actions/Branch/BranchUpdaterService/model/OnBranchUpdateCaller";
import useOpenDeleteMergeRequestModal from "@ext/git/core/GitMergeRequest/components/DeleteMergeRequestModal";
import MergeRequestTab from "@ext/git/core/GitMergeRequest/components/MergeRequestTab";
import { MERGE_REQUEST_PANEL_ID } from "@ext/git/core/GitMergeRequest/constants";
import t from "@ext/localization/locale/translate";
import {
	FloatingPanel,
	PanelEmptyState,
	PanelEmptyStateDescription,
	PanelEmptyStateIcon,
	PanelEmptyStateTitle,
} from "@ui-kit/FloatingPanel";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { useState } from "react";
import { MergeRequestPanelMenu } from "./MergeRequestPanelMenu";
import { useMergeRequestPanelAvailability } from "./useMergeRequestPanelAvailability";
import { useMergeRequestPanelState } from "./useMergeRequestPanelState";
import { useRestoreArticleViewOnPanelClose } from "./useRestoreArticleViewOnPanelClose";

export const MergeRequestPanel = () => {
	const isOffline = useIsOffline();
	const { mergeRequest, isDraft } = useMergeRequestPanelState();
	useMergeRequestPanelAvailability(!!mergeRequest);
	useRestoreArticleViewOnPanelClose();
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { call: deleteMergeRequest } = useApi({
		url: (api) => api.deleteMergeRequest(),
		onDone: () => BranchUpdaterService.updateBranch(apiUrlCreator, OnBranchUpdateCaller.MergeRequest),
	});

	useOpenDeleteMergeRequestModal({
		isOpen: isDeleteModalOpen,
		onClose: () => setIsDeleteModalOpen(false),
		onConfirm: deleteMergeRequest,
	});

	return (
		<FloatingPanel
			headerActions={
				mergeRequest && (
					<ComponentVariantProvider variant="glass">
						<MergeRequestPanelMenu onDelete={() => setIsDeleteModalOpen(true)} />
					</ComponentVariantProvider>
				)
			}
			icon="git-pull-request-arrow"
			id={MERGE_REQUEST_PANEL_ID}
			interactionDisabled={isOffline}
			title={t("git.merge-requests.name")}
		>
			<ComponentVariantProvider variant="glass">
				<div className="flex min-h-0 flex-1 flex-col">
					{mergeRequest ? (
						<MergeRequestTab isDraft={isDraft} mergeRequest={mergeRequest} />
					) : (
						<PanelEmptyState>
							<PanelEmptyStateIcon icon="git-pull-request" />
							<PanelEmptyStateTitle>{t("git.merge-requests.empty-state.title")}</PanelEmptyStateTitle>
							<PanelEmptyStateDescription className="max-w-64">
								{t("git.merge-requests.empty-state.description")}
							</PanelEmptyStateDescription>
						</PanelEmptyState>
					)}
				</div>
			</ComponentVariantProvider>
		</FloatingPanel>
	);
};
