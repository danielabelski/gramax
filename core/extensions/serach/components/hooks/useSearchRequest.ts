import { isAbortError } from "@core/utils/isAbortError";
import useWatch from "@core-ui/hooks/useWatch";
import type { SettledQuery } from "@ext/serach/components/hooks/useSearchQuery";
import type { SearchGateway } from "@ext/serach/components/model/searchGateway";
import { canSearch, type SearchParams } from "@ext/serach/components/model/searchParams";
import { SearchRequestError } from "@ext/serach/components/model/searchRequestError";
import { parseChatResponse, type SearchData } from "@ext/serach/components/model/searchResponse";
import type { RowSearchResult } from "@ext/serach/utils/SearchRowsModel";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

export interface UseSearchRequestArgs {
	gateway: SearchGateway;
	params: SearchParams;
	query: SettledQuery;
	enabled: boolean;
	onResults?: (query: string, rows: RowSearchResult[]) => void;
	onError?: (error: unknown) => void;
}

export interface UseSearchRequestResult {
	data: SearchData | null;
	error: unknown;
	/** Runs the same search again — used when the index finishes rebuilding under us. */
	reload: () => void;
}

export const useSearchRequest = (args: UseSearchRequestArgs): UseSearchRequestResult => {
	const { params, query, enabled } = args;
	const [data, setData] = useState<SearchData | null>(null);
	const [error, setError] = useState<unknown>(null);
	const [attempt, retry] = useReducer((attempt: number) => attempt + 1, 0);

	const argsRef = useRef(args);
	argsRef.current = args;

	/** What the next request would ask for. A new identity invalidates what is on screen. */
	const target = useMemo(() => ({ params, query, attempt }), [params, query, attempt]);
	// Marks the target a request has run to completion for, so reopening the dialog
	// does not repeat a search that already answered — but does retry an aborted one.
	const completedRef = useRef<object | null>(null);

	useWatch(() => {
		completedRef.current = null;
		setData(null);
		setError(null);
	}, [target]);

	useEffect(() => {
		if (!enabled || completedRef.current === target) return;
		if (!canSearch(params, query.value)) return;

		const controller = new AbortController();

		const complete = () => {
			completedRef.current = target;
		};

		const run = async () => {
			const { gateway, onResults, onError } = argsRef.current;
			try {
				if (params.aiEnabled) {
					let buffer = "";
					await gateway.chat(params, query.value, controller.signal, async (chunk) => {
						buffer += chunk;
						const nodes = await parseChatResponse(buffer);
						if (controller.signal.aborted) return;
						setData({ kind: "chat", nodes });
					});
					if (controller.signal.aborted) return;

					complete();
					if (!buffer.trim()) setError(new Error("chat response was empty"));
					return;
				}

				const rows = await gateway.search(params, query.value, controller.signal);
				if (controller.signal.aborted || !rows) return;

				complete();
				setData({ kind: "search", rows });
				onResults?.(query.value, rows);
			} catch (thrown) {
				if (isAbortError(thrown)) return;
				complete();
				setError(thrown);
				// FetchService already showed the user a modal for a failed request
				if (!(thrown instanceof SearchRequestError)) onError?.(thrown);
			}
		};

		void run();

		return () => controller.abort();
	}, [target, enabled, params, query]);

	return { data, error, reload: retry };
};
