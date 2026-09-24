import { type WorkspaceLayoutItem, WorkspaceView } from "@ext/workspace/WorkspaceConfig";
import { type HomeFolder, type HomeItem, type HomeSections, isHomeCatalog, UNCATEGORIZED_ID } from "./homeLayoutTypes";

const parseFolder = (folder: HomeFolder): WorkspaceLayoutItem => ({
	type: "section",
	id: folder.id,
	title: folder.title,
	view: WorkspaceView.folder,
	items: [...folder.items.map((name) => ({ type: "catalog" as const, name })), ...(folder.children ?? [])],
	...(folder.icon ? { icon: folder.icon } : {}),
	...(folder.description ? { description: folder.description } : {}),
});

const parseItems = (items: HomeItem[]): WorkspaceLayoutItem[] =>
	items.map((item) => (isHomeCatalog(item) ? { type: "catalog", name: item.name } : parseFolder(item)));

export const parseSections = (sections: HomeSections): WorkspaceLayoutItem[] => [
	...sections
		.filter((section) => section.id !== UNCATEGORIZED_ID)
		.map(
			(section): WorkspaceLayoutItem => ({
				type: "section",
				id: section.id,
				title: section.title ?? "",
				view: WorkspaceView.section,
				items: parseItems(section.items),
				...(section.icon ? { icon: section.icon } : {}),
				...(section.description ? { description: section.description } : {}),
			}),
		),
	...parseItems(sections.find((section) => section.id === UNCATEGORIZED_ID)?.items ?? []),
];

/** Every catalog the saving client had on screen, folders included — what it saw, not where it put it. */
const layoutCatalogs = (items: WorkspaceLayoutItem[]): string[] =>
	items.flatMap((item) => (item.type === "catalog" ? [item.name] : layoutCatalogs(item.items)));

export const seenCatalogs = (sections: HomeSections): string[] =>
	sections.flatMap((section) =>
		section.items.flatMap((item) =>
			item.type === "catalog" ? [item.name] : [...item.items, ...layoutCatalogs(item.children ?? [])],
		),
	);
