import type { WorkspaceLayoutItem } from "@ext/workspace/WorkspaceConfig";

export const UNCATEGORIZED_ID = "__uncategorized__";

export const NEW_SECTION_KEY = "untitled";

export const NEW_FOLDER_KEY = "folder";

export type HomeLayoutEditScope = "personal" | "global";

export type HomeCatalog = {
	type: "catalog";
	name: string;
};

export type HomeFolder = {
	type: "folder";
	id: string;
	title: string;
	items: string[];
	href?: string;
	icon?: string;
	description?: string;
	/** Descendants are not editable from the homepage, but must survive a layout save. */
	children?: WorkspaceLayoutItem[];
};

export type HomeItem = HomeCatalog | HomeFolder;

export type HomeItemKind = HomeItem["type"];

export type HomeSection = {
	id: string;
	title?: string;
	icon?: string;
	description?: string;
	items: HomeItem[];
};

export type HomeSections = HomeSection[];

export type LayoutSnapshot = { sections: HomeSections };

export const isHomeCatalog = (item: HomeItem): item is HomeCatalog => item.type === "catalog";

export const isHomeFolder = (item: HomeItem): item is HomeFolder => item.type === "folder";

export const canNavigateHomeFolder = (
	folder: HomeFolder,
	editMode?: boolean,
): folder is HomeFolder & { href: string } => !editMode && Boolean(folder.href);
