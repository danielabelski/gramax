import { isAbortError } from "@core/utils/isAbortError";
import { readNDJson } from "@core/utils/readNDJson";
import type { SearchGateway } from "@ext/serach/components/model/searchGateway";
import type { ProgressItem, ResourceFilter } from "@ext/serach/Searcher";
import { useEffect, useRef, useState } from "react";

const COMPLETE = 1;

export interface UseSearchIndexingArgs {
	gateway: SearchGateway;
	enabled: boolean;
	reindexOnOpen: boolean;
	catalogName?: string;
	resourceFilter: ResourceFilter;
	onComplete?: () => void;
}

export interface UseSearchIndexingResult {
	inProgress: boolean;
	progress: number;
}

export const useSearchIndexing = (args: UseSearchIndexingArgs): UseSearchIndexingResult => {
	const { enabled, reindexOnOpen, catalogName, resourceFilter } = args;
	const [progress, setProgress] = useState(COMPLETE);
	const inProgress = progress !== COMPLETE;

	const argsRef = useRef(args);
	argsRef.current = args;

	useEffect(() => {
		if (!enabled) return;

		const controller = new AbortController();

		const run = async () => {
			const { gateway } = argsRef.current;
			try {
				if (reindexOnOpen) void gateway.resetIndex(catalogName);

				const stream = await gateway.indexingProgress(resourceFilter, controller.signal);
				if (!stream) return;

				for await (const item of readNDJson<ProgressItem>(stream, controller.signal)) {
					const type = item.type;
					switch (type) {
						case "progress":
							setProgress(item.progress);
							break;
						case "done":
							setProgress(COMPLETE);
							break;
						default:
							throw new Error(`Unexpected task stream item type ${type}`);
					}
				}
			} catch (error) {
				if (isAbortError(error)) return;
			}
		};

		void run();

		return () => controller.abort();
	}, [enabled, reindexOnOpen, catalogName, resourceFilter]);

	const startedRef = useRef(false);
	useEffect(() => {
		if (startedRef.current && !inProgress) argsRef.current.onComplete?.();
		startedRef.current = inProgress;
	}, [inProgress]);

	return { inProgress, progress };
};
