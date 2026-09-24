import type { NDJsonReadStream } from "@core/utils/readNDJson";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import type { SearchParams } from "@ext/serach/components/model/searchParams";
import { chatStream } from "@ext/serach/components/utils/chatStream";
import { getSearchData } from "@ext/serach/components/utils/getSearchData";
import type { ResourceFilter } from "@ext/serach/Searcher";
import type { RowSearchResult } from "@ext/serach/utils/SearchRowsModel";

export interface SearchGateway {
	/** Resolves `undefined` only when the request was aborted — a failed request throws `SearchRequestError`. */
	search(params: SearchParams, query: string, signal: AbortSignal): Promise<RowSearchResult[] | undefined>;
	chat(
		params: SearchParams,
		query: string,
		signal: AbortSignal,
		onChunk: (text: string) => Promise<void>,
	): Promise<void>;
	resetIndex(catalogName: string | undefined): Promise<void>;
	indexingProgress(resourceFilter: ResourceFilter, signal: AbortSignal): Promise<NDJsonReadStream | undefined>;
	chatAvailable(): Promise<boolean>;
}

export const createSearchGateway = (apiUrlCreator: ApiUrlCreator): SearchGateway => ({
	search: (params, query, signal) =>
		getSearchData({
			url: apiUrlCreator.getSearchDataUrl(query, params.catalogName, undefined, params.articlesLanguage),
			signal,
			onlyArticles: params.onlyArticles,
			resourceFilter: params.resourceFilter,
			propertyFilter: params.propertyFilter,
			articleRefFilter: params.articleRefFilter,
			catalogNames: params.catalogNames,
		}),

	chat: (params, query, signal, onChunk) =>
		chatStream({
			url: apiUrlCreator.getSearchChatUrl(
				query,
				params.catalogName,
				params.articlesLanguage,
				params.responseLanguage,
				params.articleRefFilter,
			),
			query,
			onData: onChunk,
			catalogNames: params.catalogNames,
			signal,
		}),

	resetIndex: async (catalogName) => {
		await FetchService.fetch<unknown>(apiUrlCreator.getResetSearchDataUrl(catalogName));
	},

	indexingProgress: async (resourceFilter, signal) => {
		const res = await FetchService.fetch<unknown>(
			apiUrlCreator.getIndexingProgressUrl(resourceFilter),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			signal,
		);
		if (!res.ok) return undefined;
		return res.body.getReader();
	},

	chatAvailable: async () => {
		const res = await FetchService.fetch<boolean>(apiUrlCreator.getSearchChatAvailableUrl());
		if (!res.ok) return false;
		return (await res.json()) === true;
	},
});
