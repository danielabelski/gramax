import { uniqueName } from "@core/utils/uniqueName";
import { transliterate } from "@core-ui/languageConverter/transliterate";
import {
	type HomeFolder,
	type HomeSections,
	isHomeCatalog,
	isHomeFolder,
	NEW_FOLDER_KEY,
	NEW_SECTION_KEY,
} from "./homeLayoutTypes";
import { allLayoutIds, insertBeforeUncategorized, upsertUncategorizedItems } from "./sectionHelpers";

export const addGroup = (sections: HomeSections, title: string): HomeSections => {
	const key = uniqueName(NEW_SECTION_KEY, allLayoutIds(sections));
	return insertBeforeUncategorized(sections, { id: key, title, items: [] });
};

export const setGroupTitle = (sections: HomeSections, key: string, title: string): HomeSections => {
	const section = sections.find((section) => section.id === key);
	if (!section || section.title === title) return sections;
	const newKey = uniqueName(
		transliterate(title, { kebab: true }) || NEW_SECTION_KEY,
		allLayoutIds(sections).filter((id) => id !== key),
	);
	return sections.map((section) => (section.id === key ? { ...section, id: newKey, title } : section));
};

export const deleteGroup = (sections: HomeSections, key: string): HomeSections => {
	const removed = sections.find((section) => section.id === key);
	if (!removed) return sections;
	return upsertUncategorizedItems(
		sections.filter((section) => section.id !== key),
		removed.items,
	);
};

/** Packs the catalogs of a section into a single folder; nested folders move out as they are. */
export const convertSectionToFolder = (sections: HomeSections, key: string): HomeSections => {
	const section = sections.find((s) => s.id === key);
	if (!section) return sections;
	const catalogs = section.items.filter(isHomeCatalog).map((item) => item.name);
	if (catalogs.length === 0) return sections;
	const folders = section.items.filter(isHomeFolder);
	const remaining = sections.filter((s) => s.id !== key);
	const title = section.title ?? key;
	const folder: HomeFolder = {
		type: "folder",
		id: uniqueName(transliterate(title, { kebab: true }) || NEW_FOLDER_KEY, [
			...allLayoutIds(remaining),
			...folders.map((folder) => folder.id),
		]),
		title,
		items: catalogs,
	};
	return upsertUncategorizedItems(remaining, [folder, ...folders]);
};
