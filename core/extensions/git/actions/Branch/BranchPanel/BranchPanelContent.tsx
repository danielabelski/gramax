/** biome-ignore-all lint/correctness/useExhaustiveDependencies: apiUrlCreator changes on workspace switch */
import { useCurrentBranch } from "@components/Layouts/CatalogLayout/RightNavigation/useCurrentBranch";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import BranchUpdaterService from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import OnBranchUpdateCaller from "@ext/git/actions/Branch/BranchUpdaterService/model/OnBranchUpdateCaller";
import t from "@ext/localization/locale/translate";
import { PanelLoader } from "@ui-kit/FloatingPanel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BranchList } from "./components/BranchList";
import { BranchSearch } from "./components/BranchSearch";
import { CreateBranchForm } from "./components/CreateBranchForm";
import { getExistingBranchNames, splitBranches } from "./logic/branchSelectors";
import { useBranchActions } from "./logic/useBranchActions";
import { useBranches } from "./logic/useBranches";

type BranchPanelContentProps = {
	allowCreate: boolean;
	allowActions: boolean;
	catalogName: string;
	isCreating: boolean;
	setIsCreating: (isCreating: boolean) => void;
};

export const BranchPanelContent = ({
	allowCreate,
	allowActions,
	catalogName,
	isCreating,
	setIsCreating,
}: BranchPanelContentProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { branch: currentBranch } = useCurrentBranch(true, apiUrlCreator);
	const { branches, isLoading, refresh } = useBranches();
	const [searchValue, setSearchValue] = useState("");

	const closeCreateForm = useCallback(async () => {
		setIsCreating(false);
		await refresh();
	}, [refresh, setIsCreating]);

	const { switchBranch, createBranch, isProcessing } = useBranchActions({
		catalogName,
		currentBranch: currentBranch?.name ?? "",
		onSwitched: refresh,
		onCreated: closeCreateForm,
	});

	useEffect(() => () => setIsCreating(false), [setIsCreating]);

	const { branches: filteredBranches } = useMemo(
		() => splitBranches({ branches, currentBranch, query: searchValue }),
		[branches, currentBranch, searchValue],
	);

	const onMergeRequestCreate = useCallback(() => {
		void BranchUpdaterService.updateBranch(apiUrlCreator, OnBranchUpdateCaller.MergeRequest);
		void refresh();
	}, [apiUrlCreator, refresh]);

	return (
		<div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
			<BranchSearch onChange={setSearchValue} value={searchValue} />
			{isLoading || isProcessing ? (
				<PanelLoader size="md">{t("loading")}</PanelLoader>
			) : (
				<BranchList
					branches={filteredBranches}
					currentBranchName={currentBranch?.name}
					onMergeRequestCreate={onMergeRequestCreate}
					onRefresh={refresh}
					onSelect={(branchName) => void switchBranch(branchName)}
					showMenu={allowActions}
				/>
			)}
			{allowCreate && (
				<CreateBranchForm
					existingBranches={getExistingBranchNames(branches, currentBranch)}
					isDisabled={isProcessing}
					isOpen={isCreating}
					onCreate={(branchName) => void createBranch(branchName)}
				/>
			)}
		</div>
	);
};
