export type UserCatalogPropsSet = {
	[catalogName: string]: UserCatalogProps;
};

export interface UserCatalogProps {
	branches?: string[];
	mainBranch: string;
	mainBranchProtected: boolean;
}
