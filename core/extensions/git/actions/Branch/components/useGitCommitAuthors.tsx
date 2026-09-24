import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import { RequestStatus, useApi } from "@core-ui/hooks/useApi";
import type { CommitAuthorInfo } from "@ext/git/core/GitCommands/LibGit2IntermediateCommands";
import { useEffect, useMemo, useRef } from "react";

export type UseGitCommitAuthors = {
	authors: CommitAuthorInfo[];
	isLoading: boolean;
};

const commitAuthorsUrl = (api: ApiUrlCreator) => api.getGitCommitAuthors();

/**
 * authors of the commits of the whole catalog — or, when `pathspecs` is given, only of the commits
 * that edited these paths
 */
const useGitCommitAuthors = (shouldFetch: boolean, pathspecs?: string[]) => {
	const requested = useRef<string>(null);
	const key = pathspecs?.length ? pathspecs.join("\n") : "";

	// biome-ignore lint/correctness/useExhaustiveDependencies: key stands for pathspecs
	const opts = useMemo(
		() => ({ body: pathspecs?.length ? { pathspecs } : undefined, parse: "json" as const }),
		[key],
	);

	const { data, status, call } = useApi<CommitAuthorInfo[]>({
		url: commitAuthorsUrl,
		opts,
		map: (authors) => [...(authors ?? [])].sort((a, b) => b.count - a.count),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: key stands for pathspecs, call is new every render
	useEffect(() => {
		// requests never overlap: a set picked while one is running is taken up once the status leaves Loading
		if (!shouldFetch || status === RequestStatus.Loading || requested.current === key) return;

		requested.current = key;
		void call();
	}, [shouldFetch, key, status]);

	// on a failed request useApi reports the error itself; here it is enough not to keep the previous authors
	return {
		authors: status === RequestStatus.Error ? [] : (data ?? []),
		isLoading: shouldFetch && (status === RequestStatus.Init || status === RequestStatus.Loading),
	};
};

export default useGitCommitAuthors;
