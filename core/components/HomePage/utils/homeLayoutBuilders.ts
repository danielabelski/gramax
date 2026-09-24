import type { Section } from "@core/SitePresenter/SitePresenter";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { WorkspaceView } from "@ext/workspace/WorkspaceConfig";
import {
	type HomeCatalog,
	type HomeFolder,
	type HomeItem,
	type HomeSections,
	UNCATEGORIZED_ID,
} from "./homeLayoutTypes";
import { layoutItemId } from "./workspaceLayout";

export const catalogItem = (name: string): HomeCatalog => ({ type: "catalog", name });

const sectionCatalogs = (section: Section) => (section.catalogLinks || []).map((link) => catalogItem(link.name));

export const sectionToFolder = (id: string, section: Section): HomeFolder => ({
	type: "folder",
	id,
	title: section.title,
	items: (section.catalogLinks || []).map((link) => link.name),
	href: section.href,
	...(section.icon ? { icon: section.icon } : {}),
	...(section.description ? { description: section.description } : {}),
	...(section.layoutItems ? { children: section.layoutItems.filter((item) => item.type === "section") } : {}),
});

export const buildLinkIndex = (section: Section): Record<string, CatalogLink> => {
	const linkByName: Record<string, CatalogLink> = {};
	const collect = (current: Section) => {
		for (const link of current.catalogLinks || []) linkByName[link.name] = link;
		for (const child of Object.values(current.sections || {})) collect(child);
	};
	collect(section);
	return linkByName;
};

const homeItemId = (item: HomeItem) => (item.type === "catalog" ? `catalog:${item.name}` : `section:${item.id}`);

const sectionItems = (section: Section, includeFolder: (child: Section) => boolean = () => true): HomeItem[] => {
	const candidates = [
		...Object.entries(section.sections || {})
			.filter(([, child]) => includeFolder(child))
			.map(([id, child]) => sectionToFolder(id, child)),
		...sectionCatalogs(section),
	];
	const byId = new Map(candidates.map((item) => [homeItemId(item), item]));
	const ordered = (section.layoutItems ?? []).flatMap((item) => {
		const found = byId.get(layoutItemId(item));
		return found ? [found] : [];
	});
	const placed = new Set(ordered);
	return [...ordered, ...candidates.filter((item) => !placed.has(item))];
};

export const buildState = (section: Section) => {
	const rootSections = Object.entries(section.sections || {});
	const sections: HomeSections = rootSections
		.filter(([, subSection]) => subSection.view === WorkspaceView.section)
		.map(([id, subSection]) => ({
			id,
			title: subSection.title,
			items: sectionItems(subSection),
			...(subSection.icon ? { icon: subSection.icon } : {}),
			...(subSection.description ? { description: subSection.description } : {}),
		}));

	const uncategorizedItems = sectionItems(section, (child) => child.view !== WorkspaceView.section);

	// uncategorized has no header: its label is rendered by the divider above it
	return { sections: [...sections, { id: UNCATEGORIZED_ID, items: uncategorizedItems }] };
};
