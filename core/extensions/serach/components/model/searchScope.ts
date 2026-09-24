import type { Section } from "@core/SitePresenter/SitePresenter";
import { WorkspaceView } from "@ext/workspace/WorkspaceConfig";

const catalogSearchScopes = ["all", "catalog", "article"] as const;
const sectionSearchScopes = ["all", "folder"] as const;

// Catalog - Search in catalog
// Homepage - Search in homepage (if not in folder)
// Section - Search in homepage folder
export type SearchScopeMode = "catalog" | "homepage" | "section";

export type CatalogSearchScope = (typeof catalogSearchScopes)[number];
export type SectionSearchScope = (typeof sectionSearchScopes)[number];

export type ScopeByMode = {
	catalog: CatalogSearchScope;
	section: SectionSearchScope;
	homepage: never;
};

export type SearchScope<M extends SearchScopeMode = SearchScopeMode> = ScopeByMode[M];

export const getScopesByMode = <M extends SearchScopeMode>(mode: M, isStatic: boolean): SearchScope<M>[] => {
	const scopes = scopesByMode[mode];
	if (isStatic) return scopes.filter((scope) => scope !== "all");
	return scopes;
};

export const initialScopeByMode: Record<SearchScopeMode, SearchScope> = {
	catalog: "catalog",
	section: "folder",
	homepage: "all",
};

export const getSearchMode = (section: Section | undefined, isHomePage: boolean): SearchScopeMode => {
	if (section?.view === WorkspaceView.folder) return "section";
	return isHomePage ? "homepage" : "catalog";
};

export const nextSearchScope = (mode: SearchScopeMode, scope: SearchScope, isStatic: boolean): SearchScope => {
	const scopes = getScopesByMode(mode, isStatic);
	if (!scopes.length) return initialScopeByMode[mode];
	return scopes[(scopes.indexOf(scope) + 1) % scopes.length];
};

const scopesByMode: { [M in SearchScopeMode]: SearchScope<M>[] } = {
	catalog: [...catalogSearchScopes],
	section: [...sectionSearchScopes],
	homepage: [],
};
