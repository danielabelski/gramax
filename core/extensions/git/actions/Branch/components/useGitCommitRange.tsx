import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import { RequestStatus, useApi } from "@core-ui/hooks/useApi";
import type { CommitRangeInfo } from "@ext/git/core/GitCommands/LibGit2IntermediateCommands";
import { useEffect, useMemo, useRef } from "react";
import type { DateRange } from "react-day-picker";

const commitRangeUrl = (api: ApiUrlCreator) => api.getGitCommitRange();

/**
 * oldest and newest commit of the whole catalog — or, when `pathspecs` is given, of these paths;
 * `available` is the same range as the days it spans, ready for a calendar
 */
const useGitCommitRange = (shouldFetch: boolean, pathspecs?: string[]) => {
	const requested = useRef<string>(null);
	const key = pathspecs?.length ? pathspecs.join("\n") : "";

	// biome-ignore lint/correctness/useExhaustiveDependencies: key stands for pathspecs
	const opts = useMemo(
		() => ({ body: pathspecs?.length ? { pathspecs } : undefined, parse: "json" as const }),
		[key],
	);

	const { data, status, call } = useApi<CommitRangeInfo>({ url: commitRangeUrl, opts });

	// biome-ignore lint/correctness/useExhaustiveDependencies: key stands for pathspecs, call is new every render
	useEffect(() => {
		// requests never overlap: a set picked while one is running is taken up once the status leaves Loading
		if (!shouldFetch || status === RequestStatus.Loading || requested.current === key) return;

		requested.current = key;
		void call();
	}, [shouldFetch, key, status]);

	// on a failed request useApi reports the error itself; here it is enough not to keep the previous range
	const range = status === RequestStatus.Error ? null : (data ?? null);

	// whole days in the local timezone: the range has to cover the day its edge commits were made on
	const available: DateRange = useMemo(() => {
		if (!range) return undefined;

		return {
			from: new Date(new Date(range.start.date).setHours(0, 0, 0, 0)),
			to: new Date(new Date(range.end.date).setHours(23, 59, 59, 999)),
		};
	}, [range]);

	return { range, available };
};

export default useGitCommitRange;
