import { uniqueName } from "@core/utils/uniqueName";
import { transliterate } from "@core-ui/languageConverter/transliterate";
import {
	type HomeFolder,
	type HomeItemKind,
	type HomeSections,
	isHomeCatalog,
	isHomeFolder,
	NEW_FOLDER_KEY,
} from "./homeLayoutTypes";
import { allLayoutIds, findContainer, itemMatches } from "./sectionHelpers";

/**
 * Drops the dragged catalog onto `targetRawId`: joins an existing folder, or creates one under `newFolderTitle` when
 * the target is a catalog itself. Returns `null` when the drop makes no sense — the caller then leaves the layout
 * alone.
 */
export const mergeItems = (
	sections: HomeSections,
	activeRawId: string,
	targetType: HomeItemKind,
	targetRawId: string,
	newFolderTitle: string,
): HomeSections | null => {
	const fromId = findContainer(sections, "catalog", activeRawId);
	if (!fromId) return null;

	const toId = findContainer(sections, targetType, targetRawId);
	if (!toId) return null;

	const fromSection = sections.find((section) => section.id === fromId);
	const toSection = sections.find((section) => section.id === toId);
	if (!fromSection || !toSection) return null;

	const activeItem = fromSection.items.find((item) => itemMatches(item, "catalog", activeRawId));
	if (!activeItem || !isHomeCatalog(activeItem)) return null;

	const fromWithout = fromSection.items.filter((item) => !itemMatches(item, "catalog", activeRawId));
	const targetItems = fromId === toId ? fromWithout : [...toSection.items];
	const targetItem = targetItems.find((item) => itemMatches(item, targetType, targetRawId));
	if (!targetItem) return null;

	const targetFolder = isHomeFolder(targetItem) ? targetItem : null;
	const mergedFolder: HomeFolder = targetFolder
		? { ...targetFolder, items: Array.from(new Set([...targetFolder.items, activeRawId])) }
		: {
				type: "folder",
				id: uniqueName(
					transliterate(newFolderTitle, { kebab: true }) || NEW_FOLDER_KEY,
					allLayoutIds(sections),
				),
				title: newFolderTitle,
				items: Array.from(new Set([targetRawId, activeRawId])),
			};

	const replacedTarget = targetItems.map((item) =>
		itemMatches(item, targetType, targetRawId) ? mergedFolder : item,
	);

	return sections.map((section) => {
		if (section.id === fromId && section.id === toId) return { ...section, items: replacedTarget };
		if (section.id === fromId) return { ...section, items: fromWithout };
		if (section.id === toId) return { ...section, items: replacedTarget };
		return section;
	});
};
