import { uniqueName } from "@core/utils/uniqueName";
import { transliterate } from "@core-ui/languageConverter/transliterate";
import { catalogItem } from "./homeLayoutBuilders";
import {
	type HomeFolder,
	type HomeSection,
	type HomeSections,
	isHomeFolder,
	NEW_FOLDER_KEY,
	NEW_SECTION_KEY,
} from "./homeLayoutTypes";
import {
	allLayoutIds,
	findContainer,
	findFolder,
	insertBeforeUncategorized,
	isSameOrder,
	itemMatches,
	updateSectionItems,
	upsertUncategorizedItems,
} from "./sectionHelpers";

/** Turns a folder back into a section of its own, placed above the uncategorized one. */
export const convertFolderToSection = (sections: HomeSections, folderId: string): HomeSections => {
	const containerId = findContainer(sections, "folder", folderId);
	if (!containerId) return sections;
	const container = sections.find((section) => section.id === containerId);
	const folder = container?.items.find((item): item is HomeFolder => isHomeFolder(item) && item.id === folderId);
	if (!folder) return sections;
	const slug = transliterate(folder.title, { kebab: true }) || NEW_SECTION_KEY;
	const newSection: HomeSection = {
		id: uniqueName(
			slug,
			allLayoutIds(sections).filter((id) => id !== folderId),
		),
		title: folder.title,
		items: folder.items.map(catalogItem),
	};
	return insertBeforeUncategorized(
		updateSectionItems(sections, containerId, (items) =>
			items.filter((item) => !itemMatches(item, "folder", folderId)),
		),
		newSection,
	);
};

/** Unpacks the folder where it stands, so its catalogs keep the place the folder occupied. */
export const deleteFolder = (sections: HomeSections, folderId: string): HomeSections => {
	const containerId = findContainer(sections, "folder", folderId);
	if (!containerId) return sections;
	return updateSectionItems(sections, containerId, (items) => {
		const index = items.findIndex((item) => itemMatches(item, "folder", folderId));
		const folder = items[index];
		if (!folder || !isHomeFolder(folder)) return items;
		return [...items.slice(0, index), ...folder.items.map(catalogItem), ...items.slice(index + 1)];
	});
};

export const renameFolder = (sections: HomeSections, folderId: string, title: string): HomeSections => {
	const containerId = findContainer(sections, "folder", folderId);
	if (!containerId) return sections;
	return updateSectionItems(sections, containerId, (items) => {
		const folder = findFolder(items, folderId);
		if (!folder || folder.title === title) return items;
		const newId = uniqueName(
			transliterate(title, { kebab: true }) || NEW_FOLDER_KEY,
			allLayoutIds(sections).filter((id) => id !== folderId),
		);
		return items.map((item) => (isHomeFolder(item) && item.id === folderId ? { ...item, id: newId, title } : item));
	});
};

/** Moves a catalog out into the uncategorized section, dropping the folder once it holds nothing. */
export const removeFromFolder = (
	sections: HomeSections,
	sectionId: string,
	folderId: string,
	catalogName: string,
): HomeSections => {
	const withoutCatalog = updateSectionItems(sections, sectionId, (items) => {
		const folder = findFolder(items, folderId);
		if (!folder?.items.includes(catalogName)) return items;
		return items
			.map((item) =>
				isHomeFolder(item) && item.id === folderId
					? { ...item, items: item.items.filter((name) => name !== catalogName) }
					: item,
			)
			.filter((item) => !(isHomeFolder(item) && item.id === folderId && item.items.length === 0));
	});
	if (withoutCatalog === sections) return sections;
	return upsertUncategorizedItems(withoutCatalog, [catalogItem(catalogName)]);
};

export const reorderFolderItems = (
	sections: HomeSections,
	sectionId: string,
	folderId: string,
	newOrder: string[],
): HomeSections => {
	return updateSectionItems(sections, sectionId, (items) => {
		const folder = findFolder(items, folderId);
		if (!folder || isSameOrder(folder.items, newOrder)) return items;
		return items.map((item) => (isHomeFolder(item) && item.id === folderId ? { ...item, items: newOrder } : item));
	});
};
