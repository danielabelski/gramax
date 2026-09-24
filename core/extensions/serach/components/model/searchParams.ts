import type { ContentLanguage } from "@ext/localization/core/model/Language";
import type { SearchScope, SearchScopeMode } from "@ext/serach/components/model/searchScope";
import { buildPropertyFilter } from "@ext/serach/components/propertyFilter/buildPropertyFilter";
import type { FilterablePropertyItem } from "@ext/serach/components/propertyFilter/propertyFilterModel";
import type { ArticleLanguage } from "@ext/serach/modulith/SearchArticle";
import type { PropertyFilter, ResourceFilter } from "@ext/serach/Searcher";

/** Everything a search depends on except the query itself. */
export interface SearchParams {
	aiEnabled: boolean;
	catalogName?: string;
	catalogNames?: string[];
	articleRefFilter?: string;
	articlesLanguage?: ArticleLanguage;
	responseLanguage?: ContentLanguage;
	onlyArticles: boolean;
	resourceFilter?: ResourceFilter;
	propertyFilter?: PropertyFilter;
}

export interface SearchParamsInput {
	mode: SearchScopeMode;
	scope: SearchScope;
	aiEnabled: boolean;
	catalogName?: string;
	catalogDefaultLanguage?: ContentLanguage;
	currentArticleLanguage?: ContentLanguage;
	currentArticleRefPath?: string;
	sectionCatalogNames?: string[];
	resourceFilter: ResourceFilter;
	resourcesEnabled: boolean;
	selectedProperties: FilterablePropertyItem[];
}

export const canUsePropertyFilter = (mode: SearchScopeMode, scope: SearchScope, aiEnabled: boolean): boolean =>
	mode === "catalog" && scope !== "all" && !aiEnabled;

export const buildSearchParams = (input: SearchParamsInput): SearchParams => {
	const {
		mode,
		scope,
		aiEnabled,
		catalogName,
		catalogDefaultLanguage,
		currentArticleLanguage,
		currentArticleRefPath,
		sectionCatalogNames,
		resourceFilter,
		resourcesEnabled,
		selectedProperties,
	} = input;

	const catalogExists = !!catalogName;
	const inSingleCatalog = mode === "catalog" && scope !== "all";

	return {
		aiEnabled,
		catalogName: scope === "all" ? undefined : catalogName,
		catalogNames: scope === "folder" ? sectionCatalogNames : undefined,
		articleRefFilter: scope === "article" ? currentArticleRefPath : undefined,
		articlesLanguage:
			catalogExists && inSingleCatalog ? (currentArticleLanguage ?? catalogDefaultLanguage ?? "none") : undefined,
		responseLanguage: aiEnabled && catalogExists ? (currentArticleLanguage ?? catalogDefaultLanguage) : undefined,
		onlyArticles: inSingleCatalog,
		resourceFilter: resourcesEnabled && !aiEnabled ? resourceFilter : undefined,
		propertyFilter: canUsePropertyFilter(mode, scope, aiEnabled)
			? buildPropertyFilter(selectedProperties)
			: undefined,
	};
};

export const canSearch = (params: SearchParams, query: string): boolean => !!query || !!params.propertyFilter;
