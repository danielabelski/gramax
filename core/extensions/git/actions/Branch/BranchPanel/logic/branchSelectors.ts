import type ClientGitBranchData from "@ext/git/actions/Branch/model/ClientGitBranchData";
import type GitBranchData from "@ext/git/core/GitBranch/model/GitBranchData";

type SplitBranchesArgs = {
	branches: ClientGitBranchData[];
	currentBranch: GitBranchData;
	query: string;
};

type SplitBranchesResult = {
	current: GitBranchData | null;
	branches: GitBranchData[];
};

const matchesQuery = (branchName: string, query: string) => branchName.toLowerCase().includes(query);

export const splitBranches = ({ branches, currentBranch, query }: SplitBranchesArgs): SplitBranchesResult => {
	const search = query.trim().toLowerCase();
	const currentName = currentBranch?.name;
	const current = branches.find((branch) => branch.name === currentName) ?? currentBranch ?? null;
	const branchesWithCurrent =
		current && !branches.some((branch) => branch.name === current.name) ? [...branches, current] : branches;

	return {
		current: current && matchesQuery(current.name, search) ? current : null,
		branches: branchesWithCurrent.filter((branch) => matchesQuery(branch.name, search)),
	};
};

export const getExistingBranchNames = (branches: ClientGitBranchData[], currentBranch: GitBranchData): string[] => {
	const names = branches.map((branch) => branch.name);
	if (currentBranch?.name && !names.includes(currentBranch.name)) names.push(currentBranch.name);
	return names;
};
