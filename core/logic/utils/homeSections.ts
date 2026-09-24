import type { HomePageBreadcrumb, Section } from "@core/SitePresenter/SitePresenter";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import type { WorkspaceLayoutItem } from "@ext/workspace/WorkspaceConfig";

const HOME_SECTION_PREFIX = "/home";

const homeSections = {
	isHomeSectionPath: (path: string) => path?.startsWith?.(HOME_SECTION_PREFIX),

	getHomePathSections: (path: string) => {
		return homeSections.isHomeSectionPath(path) ? path.split("/").slice(2) : [];
	},

	getSectionHref: (sectionKeys: string[]) => {
		return `${HOME_SECTION_PREFIX}/${sectionKeys.join("/")}`;
	},

	buildHomeLayout: (catalogLinks: CatalogLink[], items: WorkspaceLayoutItem[]): Section => {
		const linksByName = new Map(catalogLinks.map((link) => [link.name, link]));
		const placed = new Set<CatalogLink>();

		const build = (layoutItems: WorkspaceLayoutItem[], path: string[], level: number): Section => {
			const section: Section = {
				href: path.length ? homeSections.getSectionHref(path) : "/",
				title: "",
				catalogLinks: [],
				sections: {},
				layoutItems,
			};

			for (const item of layoutItems) {
				if (item.type === "catalog") {
					const link = linksByName.get(item.name);
					if (link && !section.catalogLinks.includes(link)) {
						section.catalogLinks.push(link);
						placed.add(link);
					}
					continue;
				}

				const child = build(item.items, [...path, item.id], level + 1);
				if (level === 0) {
					for (const link of catalogLinks) {
						if (link.group === item.id && !child.catalogLinks.includes(link)) {
							child.catalogLinks.push(link);
							placed.add(link);
						}
					}
				}
				if (child.catalogLinks.length === 0 && Object.keys(child.sections ?? {}).length === 0) continue;
				Object.assign(child, {
					title: item.title,
					view: item.view ?? null,
					icon: item.icon ?? null,
					description: item.description ?? null,
				});
				section.sections[item.id] = child;
			}

			return section;
		};

		const root = build(items, [], 0);
		for (const link of catalogLinks) {
			if (!placed.has(link)) root.catalogLinks.push(link);
		}
		return root;
	},

	findSection: (
		pathSections: string[],
		section: Section,
		breadcrumb: HomePageBreadcrumb[] = [],
	): { section: Section; breadcrumb: HomePageBreadcrumb[] } => {
		if (pathSections.length === 0) return { section, breadcrumb };

		const s = section.sections[pathSections[0]];
		if (!s) return { section, breadcrumb };
		if (breadcrumb.length === 0) breadcrumb.push({ title: section.title, href: section.href });

		breadcrumb.push({ title: s.title, href: s.href });
		return homeSections.findSection(pathSections.slice(1), s, breadcrumb);
	},
};

export default homeSections;
