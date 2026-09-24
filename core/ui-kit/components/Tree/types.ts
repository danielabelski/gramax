export type TreeItemId = string;

export type TreeItem = {
	id: TreeItemId;
	children?: TreeItem[];
};
