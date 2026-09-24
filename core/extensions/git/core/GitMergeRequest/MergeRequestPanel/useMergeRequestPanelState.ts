import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import useWatch from "@core-ui/hooks/useWatch";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { extractCatalogName } from "@core-ui/utils/extractCatalogName";
import BranchUpdaterService from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import OnBranchUpdateCaller from "@ext/git/actions/Branch/BranchUpdaterService/model/OnBranchUpdateCaller";
import SyncService from "@ext/git/actions/Sync/logic/SyncService";
import type GitBranchData from "@ext/git/core/GitBranch/model/GitBranchData";
import { MERGE_REQUEST_PANEL_ID } from "@ext/git/core/GitMergeRequest/constants";
import { useMergeRequestStore } from "@ext/git/core/GitMergeRequest/logic/store/MergeRequestStore";
import type { MergeRequest } from "@ext/git/core/GitMergeRequest/model/MergeRequest";
import { useFloatingPanelStore } from "@ui-kit/FloatingPanel";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export const useMergeRequestPanelState = () => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const apiUrlCreatorRef = useRef<ApiUrlCreator>(apiUrlCreator);
	const { isNext } = usePlatform();
	const catalogName = useCatalogPropsStore((state) => extractCatalogName(state.data?.name));
	const setPanelOpen = useFloatingPanelStore((state) => state.setIsOpen);
	const { mergeRequest, isDraft, setMergeRequest, setIsDraft } = useMergeRequestStore((state) => ({
		mergeRequest: state.mergeRequest,
		isDraft: state.isDraft,
		setMergeRequest: state.setMergeRequest,
		setIsDraft: state.setIsDraft,
	}));

	useWatch(() => {
		apiUrlCreatorRef.current = apiUrlCreator;
	}, [apiUrlCreator]);

	const updateMergeRequest = useCallback(
		async (branch: GitBranchData) => {
			if (isNext) return;

			const response = await FetchService.fetch<MergeRequest | undefined>(
				apiUrlCreatorRef.current.getDraftMergeRequest(),
				undefined,
				undefined,
				undefined,
				false,
			);
			const draft = response.ok ? await response.json() : null;
			const nextMergeRequest = draft || branch?.mergeRequest || null;

			setIsDraft(!!draft && !branch?.mergeRequest);
			setMergeRequest(nextMergeRequest);
			if (!nextMergeRequest) setPanelOpen(MERGE_REQUEST_PANEL_ID, false);
		},
		[isNext, setIsDraft, setMergeRequest, setPanelOpen],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshes state for the active catalog and API context
	useEffect(() => {
		if (isNext) return;

		const onUpdateBranch = (branch: GitBranchData) => void updateMergeRequest(branch);
		const syncFinishToken = SyncService.events.on("finish", () => {
			void BranchUpdaterService.updateBranch(apiUrlCreatorRef.current, OnBranchUpdateCaller.MergeRequest);
		});
		BranchUpdaterService.addListener(onUpdateBranch);

		return () => {
			SyncService.events.off(syncFinishToken);
			BranchUpdaterService.removeListener(onUpdateBranch);
		};
	}, [catalogName, isNext, updateMergeRequest]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: catalog changes must reset panel state
	useLayoutEffect(() => {
		BranchUpdaterService.reset();
		setPanelOpen(MERGE_REQUEST_PANEL_ID, false);
		setMergeRequest(null);
		setIsDraft(false);
	}, [catalogName, setIsDraft, setMergeRequest, setPanelOpen]);

	return { mergeRequest, isDraft };
};
