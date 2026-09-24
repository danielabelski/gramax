import {
	type WorkspaceConfig,
	type WorkspaceLayout,
	type WorkspaceLayoutItem,
	type WorkspaceSection,
	WorkspaceView,
} from "@ext/workspace/WorkspaceConfig";

const legacySectionItem = (id: string, section: WorkspaceSection): WorkspaceLayoutItem => ({
	type: "section",
	id,
	title: section.title,
	...(section.view ? { view: section.view } : {}),
	...(section.icon ? { icon: section.icon } : {}),
	...(section.description ? { description: section.description } : {}),
	items: [
		...legacySectionItems(section.sections),
		...(section.catalogs ?? []).map((name) => ({ type: "catalog" as const, name })),
	],
});

const legacySectionItems = (sections?: Record<string, WorkspaceSection>): WorkspaceLayoutItem[] => {
	const entries = Object.entries(sections ?? {});
	return [
		...entries.filter(([, section]) => section.view === WorkspaceView.section),
		...entries.filter(([, section]) => section.view !== WorkspaceView.section),
	].map(([id, section]) => legacySectionItem(id, section));
};

export const resolveWorkspaceLayout = (config: WorkspaceConfig): WorkspaceLayout => {
	if (config.layout) return config.layout;
	const items = legacySectionItems(config.sections ?? config.groups);
	return {
		items,
		...(config.personalSections ? { personal: { items: legacySectionItems(config.personalSections) } } : {}),
	};
};

export const layoutItemId = (item: WorkspaceLayoutItem): string =>
	item.type === "catalog" ? `catalog:${item.name}` : `section:${item.id}`;

export const withWorkspaceLayoutItems = (
	config: WorkspaceConfig,
	items: WorkspaceLayoutItem[],
	scope: "global" | "personal",
): WorkspaceConfig => {
	const layout = resolveWorkspaceLayout(config);
	const next: WorkspaceConfig = {
		...config,
		layout: scope === "global" ? { ...layout, items } : { ...layout, personal: { items } },
	};
	delete next.groups;
	delete next.sections;
	delete next.personalSections;
	return next;
};
