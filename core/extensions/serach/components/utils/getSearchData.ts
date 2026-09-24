import FetchService from "@core-ui/ApiServices/FetchService";
import type Url from "@core-ui/ApiServices/Types/Url";
import { SearchRequestError } from "@ext/serach/components/model/searchRequestError";
import type { PropertyFilter, ResourceFilter, SearchResult } from "@ext/serach/Searcher";
import { buildArticleRows, type RowSearchResult } from "@ext/serach/utils/SearchRowsModel";

interface GetSearchDataArgs {
	url: Url;
	signal: AbortSignal;
	propertyFilter?: PropertyFilter;
	resourceFilter: ResourceFilter;
	articleRefFilter?: string;
	onlyArticles: boolean;
	catalogNames?: string[];
}

export const getSearchData = async ({
	url,
	propertyFilter,
	resourceFilter,
	articleRefFilter,
	signal,
	onlyArticles,
	catalogNames,
}: GetSearchDataArgs): Promise<RowSearchResult[] | undefined> => {
	const res = await FetchService.fetch<SearchResult[]>(
		url,
		JSON.stringify({ resourceFilter, propertyFilter, articleRefFilter, catalogNames }),
		undefined,
		undefined,
		undefined,
		undefined,
		signal,
	);
	if (signal.aborted) return;
	if (!res.ok) throw new SearchRequestError(res.status);

	const searchData = await res.json();
	const articleSearchData = searchData.filter((d) => !onlyArticles || d.type === "article");

	const { rows } = buildArticleRows(articleSearchData);

	return rows;
};
