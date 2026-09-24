/** biome-ignore-all lint/correctness/useExhaustiveDependencies: apiUrlCreator changes on workspace switch */
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import type ClientGitBranchData from "@ext/git/actions/Branch/model/ClientGitBranchData";
import { useCallback, useEffect, useState } from "react";

export const useBranches = () => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const [branches, setBranches] = useState<ClientGitBranchData[]>(null);

	const refresh = useCallback(async () => {
		const response = await FetchService.fetch<ClientGitBranchData[]>(
			apiUrlCreator.getVersionControlResetBranchesUrl(),
		);
		if (!response.ok) return;
		setBranches(await response.json());
	}, [apiUrlCreator]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { branches: branches ?? [], isLoading: !branches, refresh };
};
