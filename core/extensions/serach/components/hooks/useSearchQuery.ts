import { useDebounce } from "@core-ui/hooks/useDebounce";
import useWatch from "@core-ui/hooks/useWatch";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SettledQuery {
	value: string;
	revision: number;
}

export interface UseSearchQueryArgs {
	query: string;
	delayMs: number;
	flushOn: unknown;
}

export interface UseSearchQueryResult {
	settled: SettledQuery;
	delaying: boolean;
}

export const useSearchQuery = (args: UseSearchQueryArgs): UseSearchQueryResult => {
	const { query, delayMs, flushOn } = args;
	const [delaying, setDelaying] = useState(false);
	const [settled, setSettled] = useState<SettledQuery>({ value: query, revision: 0 });

	const settle = useCallback((value: string) => {
		setDelaying(false);
		setSettled((previous) => ({ value, revision: previous.revision + 1 }));
	}, []);

	const { start, cancel } = useDebounce(settle, delayMs);
	const debounceRef = useRef({ start, cancel });
	debounceRef.current = { start, cancel };

	// Both watchers also fire on mount, where the query is already settled.
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
	}, []);

	useWatch(() => {
		if (!mounted.current) return;
		setDelaying(true);
		debounceRef.current.start(query);
	}, [query]);

	useWatch(() => {
		if (!mounted.current) return;
		debounceRef.current.cancel();
		setDelaying(false);
		settle(query);
	}, [flushOn]);

	return { settled, delaying };
};
