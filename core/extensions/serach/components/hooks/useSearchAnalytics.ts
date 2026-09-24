import generateUniqueID from "@core/utils/generateUniqueID";
import type { RowSearchResult } from "@ext/serach/utils/SearchRowsModel";
import { emitPluginEvent } from "@plugins/api/events";
import { useCallback, useEffect, useRef } from "react";

const SESSION_ID_LENGTH = 10;

export interface SearchResultMetric {
	url: string;
	title: string;
	catalog: string | undefined;
	type: RowSearchResult["type"];
	position: number;
	isRecommended: boolean;
}

export const buildSearchResultsPayload = (rows: RowSearchResult[]): SearchResultMetric[] =>
	rows.map((row, index) => ({
		url: row.rawResult.url,
		title: row.rawResult.title.map((mark) => mark.text).join(""),
		catalog: row.type === "article" ? row.rawResult.catalog?.title : undefined,
		type: row.type,
		position: index + 1,
		isRecommended: row.type === "article" ? row.rawResult.isRecommended : false,
	}));

export type EmitSearchEvent = typeof emitPluginEvent;

export interface UseSearchAnalyticsArgs {
	open: boolean;
	emit?: EmitSearchEvent;
}

export interface UseSearchAnalyticsResult {
	onResults: (query: string, rows: RowSearchResult[], catalogName?: string) => void;
	onLinkClick: (url: string) => void;
}

export const useSearchAnalytics = (args: UseSearchAnalyticsArgs): UseSearchAnalyticsResult => {
	const { open, emit = emitPluginEvent } = args;

	const emitRef = useRef(emit);
	emitRef.current = emit;

	const sessionIdRef = useRef<string | null>(null);
	const analyticsIdRef = useRef<number | null>(null);

	useEffect(() => {
		if (open) {
			sessionIdRef.current = generateUniqueID(SESSION_ID_LENGTH);
			return;
		}

		sessionIdRef.current = null;
		analyticsIdRef.current = null;
	}, [open]);

	const onResults = useCallback((query: string, rows: RowSearchResult[], catalogName?: string) => {
		const searchSessionId = sessionIdRef.current;
		if (!query || !searchSessionId) return;

		void emitRef.current("search:start", {
			query,
			searchSessionId,
			catalogName,
			onSuccess: (searchAnalyticsId: number) => {
				analyticsIdRef.current = searchAnalyticsId;
				void emitRef.current("search:results", {
					searchAnalyticsId,
					results: buildSearchResultsPayload(rows),
				});
			},
		});
	}, []);

	const onLinkClick = useCallback((url: string) => {
		const searchAnalyticsId = analyticsIdRef.current;
		if (!searchAnalyticsId) return;

		analyticsIdRef.current = null;
		void emitRef.current("search:click", { searchAnalyticsId, articleUrl: url });
	}, []);

	return { onResults, onLinkClick };
};
