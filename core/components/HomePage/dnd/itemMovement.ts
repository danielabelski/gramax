import { arrayMove } from "@dnd-kit/sortable";
import type { HomeSections } from "../utils/homeLayoutTypes";
import { findContainer, itemMatches } from "../utils/sectionHelpers";
import { DROP_ZONE_ID_PREFIX, type ItemKind, itemKind, rawIdOf, toHomeItemKind } from "./ids";

export const moveHomeItem = (
	sections: HomeSections,
	activeKind: ItemKind,
	activeRawId: string,
	overId: string,
	allowSameContainer = false,
): HomeSections => {
	const activeItemKind = toHomeItemKind(activeKind);
	const from = findContainer(sections, activeItemKind, activeRawId);
	if (!from) return sections;

	const overKind = itemKind(overId);

	if (overKind) {
		const overItemKind = toHomeItemKind(overKind);
		const overRawId = rawIdOf(overId, overKind);
		const toKey = findContainer(sections, overItemKind, overRawId);
		if (!toKey) return sections;

		const fromSection = sections.find((section) => section.id === from);
		const toSection = sections.find((section) => section.id === toKey);
		if (!fromSection || !toSection) return sections;

		if (from === toKey) {
			if (!allowSameContainer) return sections;
			const oldIndex = fromSection.items.findIndex((item) => itemMatches(item, activeItemKind, activeRawId));
			const newIndex = fromSection.items.findIndex((item) => itemMatches(item, overItemKind, overRawId));
			if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return sections;
			return sections.map((section) =>
				section.id === from ? { ...section, items: arrayMove(section.items, oldIndex, newIndex) } : section,
			);
		}

		const activeItem = fromSection.items.find((item) => itemMatches(item, activeItemKind, activeRawId));
		if (!activeItem) return sections;
		const overIdx = toSection.items.findIndex((item) => itemMatches(item, overItemKind, overRawId));
		const insertIndex = overIdx >= 0 ? overIdx : toSection.items.length;
		return sections.map((section) => {
			if (section.id === from)
				return {
					...section,
					items: section.items.filter((item) => !itemMatches(item, activeItemKind, activeRawId)),
				};
			if (section.id === toKey)
				return {
					...section,
					items: [...section.items.slice(0, insertIndex), activeItem, ...section.items.slice(insertIndex)],
				};
			return section;
		});
	}

	if (!overId.startsWith(DROP_ZONE_ID_PREFIX)) return sections;

	const toKey = overId.slice(DROP_ZONE_ID_PREFIX.length);
	if (from === toKey || !sections.some((section) => section.id === toKey)) return sections;

	const fromSection = sections.find((section) => section.id === from);
	const activeItem = fromSection?.items.find((item) => itemMatches(item, activeItemKind, activeRawId));
	if (!activeItem) return sections;

	return sections.map((section) => {
		if (section.id === from)
			return {
				...section,
				items: section.items.filter((item) => !itemMatches(item, activeItemKind, activeRawId)),
			};
		if (section.id === toKey) return { ...section, items: [...section.items, activeItem] };
		return section;
	});
};
