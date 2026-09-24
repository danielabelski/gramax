import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import BranchUpdaterService from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import OnBranchUpdateCaller from "@ext/git/actions/Branch/BranchUpdaterService/model/OnBranchUpdateCaller";
import type GitBranchData from "@ext/git/core/GitBranch/model/GitBranchData";
import { useEffect, useRef, useState } from "react";

export const useCurrentBranch = (enabled: boolean, apiUrlCreator: ApiUrlCreator) => {
	const [branch, setBranch] = useState<GitBranchData>(BranchUpdaterService.branch);
	const [hasError, setHasError] = useState(false);

	const apiUrlCreatorRef = useRef(apiUrlCreator);
	apiUrlCreatorRef.current = apiUrlCreator;

	const branchScope = apiUrlCreator.getCurrentBranch().toString();

	useEffect(() => {
		if (!enabled || !branchScope) return;
		const onError = () => setHasError(true);

		BranchUpdaterService.addListener(setBranch);
		BranchUpdaterService.addOnErrorListener(onError);
		void BranchUpdaterService.updateBranch(apiUrlCreatorRef.current, OnBranchUpdateCaller.Init);

		return () => {
			BranchUpdaterService.removeListener(setBranch);
			BranchUpdaterService.removeOnErrorListener(onError);
		};
	}, [branchScope, enabled]);

	return { branch, hasError };
};
