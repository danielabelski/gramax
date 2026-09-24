/** biome-ignore-all lint/correctness/useExhaustiveDependencies: apiUrlCreator changes on workspace switch */
import ArticleUpdaterService from "@components/Article/ArticleUpdater/ArticleUpdaterService";
import { useRouter } from "@core/Api/useRouter";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import BranchUpdaterService from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import OnBranchUpdateCaller from "@ext/git/actions/Branch/BranchUpdaterService/model/OnBranchUpdateCaller";
import tryOpenMergeConflict from "@ext/git/actions/MergeConflictHandler/logic/tryOpenMergeConflict";
import type MergeData from "@ext/git/actions/MergeConflictHandler/model/MergeData";
import t from "@ext/localization/locale/translate";
import { executePluginGuardedAction } from "@plugins/logic/executePluginGuardedAction";
import { toast } from "@ui-kit/Toast";
import { useCallback, useState } from "react";

type BranchActionsCallbacks = {
	catalogName: string;
	currentBranch: string;
	onSwitched: () => Promise<void> | void;
	onCreated: () => Promise<void> | void;
};

export const useBranchActions = ({ catalogName, currentBranch, onSwitched, onCreated }: BranchActionsCallbacks) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const router = useRouter();
	const [isProcessing, setIsProcessing] = useState(false);

	const switchBranch = useCallback(
		async (branchName: string) => {
			setIsProcessing(true);
			try {
				const checkout = await executePluginGuardedAction(
					"git:branch:before-checkout",
					{ catalogName, currentBranch, targetBranch: branchName },
					() => FetchService.fetch(apiUrlCreator.getVersionControlCheckoutBranchUrl(branchName)),
				);
				if (checkout.allowed === false) {
					if (checkout.reason === "error") toast(t("app.error.something-went-wrong"), { status: "error" });
					return;
				}

				const response = checkout.result;
				if (!response.ok) return;

				router.pushPath(await response.text());
				await BranchUpdaterService.updateBranch(apiUrlCreator);
				await ArticleUpdaterService.update(apiUrlCreator);
				await onSwitched();

				const mergeDataResponse = await FetchService.fetch<MergeData>(apiUrlCreator.getMergeData());
				if (mergeDataResponse.ok) tryOpenMergeConflict({ mergeData: await mergeDataResponse.json() });
			} finally {
				setIsProcessing(false);
			}
		},
		[apiUrlCreator, catalogName, currentBranch, onSwitched, router],
	);

	const createBranch = useCallback(
		async (branchName: string) => {
			setIsProcessing(true);
			try {
				const response = await FetchService.fetch(
					apiUrlCreator.getVersionControlCreateNewBranchUrl(branchName),
				);
				if (!response.ok) return;

				await BranchUpdaterService.updateBranch(apiUrlCreator, OnBranchUpdateCaller.CheckoutToNewCreatedBranch);
				await onCreated();
			} finally {
				setIsProcessing(false);
			}
		},
		[apiUrlCreator, onCreated],
	);

	return { switchBranch, createBranch, isProcessing };
};
