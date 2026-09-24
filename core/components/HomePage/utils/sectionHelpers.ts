import {
	type HomeFolder,
	type HomeItem,
	type HomeItemKind,
	type HomeSection,
	type HomeSections,
	isHomeFolder,
	UNCATEGORIZED_ID,
} from "./homeLayoutTypes";

/**
 * Shared primitives behind every layout mutation. All of them return the very same `sections` reference when nothing
 * changed: the store treats an unchanged reference as a no-op and skips both the state write and the undo history
 * entry, so a mutation built on these helpers gets that behaviour for free.
 */

export const itemMatches = (item: HomeItem, kind: HomeItemKind, rawId: string) =>
	kind === "catalog" ? item.type === "catalog" && item.name === rawId : item.type === "folder" && item.id === rawId;

/** Every id in use anywhere in the layout — sections and folders share one id space (`findContainer` looks up folders across all sections). */
export const allLayoutIds = (sections: HomeSections): string[] =>
	sections.flatMap((section) => [section.id, ...section.items.filter(isHomeFolder).map((item) => item.id)]);

export const findContainer = (sections: HomeSections, kind: HomeItemKind, rawId: string) =>
	sections.find((section) => section.items.some((item) => itemMatches(item, kind, rawId)))?.id;

export const insertBeforeUncategorized = (sections: HomeSections, section: HomeSection): HomeSections => {
	const index = sections.findIndex((s) => s.id === UNCATEGORIZED_ID);
	if (index === -1) return [...sections, section];
	return [...sections.slice(0, index), section, ...sections.slice(index)];
};

export const isSameOrder = (a: string[], b: string[]) =>
	a.length === b.length && a.every((name, index) => name === b[index]);

export const findFolder = (items: HomeItem[], folderId: string) =>
	items.find((item): item is HomeFolder => isHomeFolder(item) && item.id === folderId);

export const updateSectionItems = (
	sections: HomeSections,
	sectionId: string,
	updater: (items: HomeItem[]) => HomeItem[],
): HomeSections => {
	const section = sections.find((section) => section.id === sectionId);
	if (!section) return sections;
	const nextItems = updater(section.items);
	if (nextItems === section.items) return sections;
	return sections.map((section) => (section.id === sectionId ? { ...section, items: nextItems } : section));
};

export const upsertUncategorizedItems = (sections: HomeSections, itemsToAppend: HomeItem[]): HomeSections => {
	if (!sections.some((section) => section.id === UNCATEGORIZED_ID))
		return [...sections, { id: UNCATEGORIZED_ID, items: itemsToAppend }];
	return updateSectionItems(sections, UNCATEGORIZED_ID, (items) => [...items, ...itemsToAppend]);
};
