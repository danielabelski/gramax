import Path from "@core/FileProvider/Path/Path";
import ApiUrlCreator from "@core-ui/ContextServices/ApiUrlCreator";
import {
	ResourceEmptyError,
	type ResourceError,
	ResourceLoadError,
	ResourceNotFoundError,
} from "@core-ui/ContextServices/ResourceService/errors";
import ResourceService from "@core-ui/ContextServices/ResourceService/ResourceService";
import {
	useResourceStore,
	useResourceStoreContext,
} from "@core-ui/ContextServices/ResourceService/store/ResourceStore.provider";
import {
	checkLfsPointer,
	getNoParentResource,
	loadExternalData,
	loadInternalData,
	type ResourceFetchResult,
} from "@core-ui/ContextServices/ResourceService/utils/utils";
import { isExternalLink } from "@core-ui/hooks/useExternalLink";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { useCallback, useEffect, useMemo, useRef } from "react";

type ResourceCallback = (buffer: Buffer, error?: ResourceError, signal?: AbortSignal) => void | Promise<void>;

type UseGetResource = (
	callback: ResourceCallback,
	src: string,
	content?: string,
	haveParentPath?: boolean,
	isPrint?: boolean,
	skipLoad?: boolean,
) => void;

type ResourceLoadResult = { error?: ResourceError } | undefined;

interface LoadingEntry {
	cacheVersion: number;
	controller: AbortController;
	promise: Promise<ResourceLoadResult>;
}

interface PrintWait {
	token: symbol;
	promise: Promise<void>;
	resolve: () => void;
}

const loadingSrcByStore = new WeakMap<object, Map<string, LoadingEntry>>();

function getLoadingSrcForStore(store: object | undefined): Map<string, LoadingEntry> {
	if (!store) return new Map();
	if (!loadingSrcByStore.has(store)) {
		loadingSrcByStore.set(store, new Map());
	}
	return loadingSrcByStore.get(store)!;
}

export const useGetResource: UseGetResource = (callback, src, content?, haveParentPath = true, isPrint?, skipLoad?) => {
	const store = useResourceStoreContext();
	const loadingPromises = useMemo(() => getLoadingSrcForStore(store), [store]);
	const printWaitRef = useRef<PrintWait>(null);
	const callbackRef = useRef(callback);
	const callbackAbortControllerRef = useRef<AbortController>(null);
	const { id, provider, update } = useResourceStore(
		(state) => ({ id: state.id, provider: state.provider, update: state.update }),
		"shallow",
	);
	const apiUrlCreator = ApiUrlCreator.value;
	const catalogName = useCatalogPropsStore((state) => state.data?.name);

	const beginPrintWait = useCallback((): symbol | undefined => {
		if (!isPrint) return;
		const previousWait = printWaitRef.current;
		const token = Symbol("resource-load");
		let resolve: () => void;
		const promise = new Promise<void>((promiseResolve) => {
			resolve = promiseResolve;
		});
		printWaitRef.current = { token, promise, resolve };
		ResourceService._loadingPromises.add(promise);
		void promise.finally(() => ResourceService._loadingPromises.delete(promise));
		previousWait?.resolve();
		return token;
	}, [isPrint]);

	const finishPrintWait = useCallback((token?: symbol) => {
		const wait = printWaitRef.current;
		if (!wait || (token && wait.token !== token)) return;
		printWaitRef.current = null;
		wait.resolve();
	}, []);

	const loadInternalDataCallback = useCallback(
		async (src: string, signal: AbortSignal): Promise<ResourceFetchResult> =>
			loadInternalData({ src, apiUrlCreator, catalogName, id, provider, signal }),
		[id, provider, catalogName],
	);

	const wrappedCallback = useCallback(
		async (buffer: Buffer | undefined, error?: ResourceError) => {
			callbackAbortControllerRef.current?.abort();
			const controller = new AbortController();
			const printWaitToken = printWaitRef.current?.token;
			callbackAbortControllerRef.current = controller;
			try {
				await Promise.resolve(callbackRef.current(buffer, error, controller.signal));
			} finally {
				if (callbackAbortControllerRef.current === controller) {
					callbackAbortControllerRef.current = null;
					finishPrintWait(printWaitToken);
				}
			}
		},
		[finishPrintWait],
	);

	const setError = useCallback(
		(result: ResourceLoadResult) => {
			if (!result?.error) return;
			void wrappedCallback(undefined, result.error);
		},
		[wrappedCallback],
	);

	const tryLoadResource = useCallback(
		async (src: string, cacheVersion: number, signal: AbortSignal) => {
			let result: { buffer?: Buffer; error?: ResourceError };
			try {
				if (!haveParentPath) {
					result = await getNoParentResource(new Path(src), apiUrlCreator, signal);
				} else {
					result = isExternalLink(src).isUrl
						? await loadExternalData(src, signal)
						: await loadInternalDataCallback(src, signal);
				}
			} catch (e) {
				if (signal.aborted) return;
				const error = new ResourceLoadError(src, e instanceof Error ? e : undefined);
				if (isPrint) return { error };
				throw e;
			}

			if (signal.aborted) return;
			if (result.error) {
				return { error: result.error };
			}

			if (!result.buffer) {
				return { error: new ResourceNotFoundError(src) };
			}

			if (!result.buffer.length) {
				return { error: new ResourceEmptyError(src) };
			}

			if (store?.getState().cacheVersion !== cacheVersion) return;
			update(src, result.buffer);
		},
		[update, haveParentPath, isPrint, loadInternalDataCallback, store],
	);

	const loadData = useCallback(
		async (src: string, cacheVersion: number) => {
			let loadingEntry = loadingPromises.get(src);
			if (!loadingEntry || loadingEntry.cacheVersion !== cacheVersion) {
				loadingEntry?.controller.abort();
				const controller = new AbortController();
				loadingEntry = {
					cacheVersion,
					controller,
					promise: tryLoadResource(src, cacheVersion, controller.signal),
				};
				loadingPromises.set(src, loadingEntry);
			}

			const result = await loadingEntry.promise;
			if (loadingPromises.get(src) === loadingEntry) loadingPromises.delete(src);
			if (loadingEntry.controller.signal.aborted) return;
			if (store?.getState().cacheVersion !== cacheVersion) return;
			setError(result);
		},
		[tryLoadResource, setError, loadingPromises, store],
	);
	const loadDataRef = useRef(loadData);

	callbackRef.current = callback;
	loadDataRef.current = loadData;

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	useEffect(() => {
		const printWaitToken = beginPrintWait();
		if (skipLoad) {
			finishPrintWait(printWaitToken);
			return;
		}
		if (content) {
			void wrappedCallback(Buffer.from(content));
			return () => {
				callbackAbortControllerRef.current?.abort();
				finishPrintWait();
			};
		}

		let hasDelivered = false;
		const deliver = (buffer: Buffer) => {
			hasDelivered = true;
			const lfsError = checkLfsPointer(buffer, src);
			void wrappedCallback(lfsError ? undefined : buffer, lfsError);
		};

		const unsubscribe = store?.subscribe((state, previousState) => {
			if (state.id !== previousState.id || state.provider !== previousState.provider) {
				beginPrintWait();
				callbackAbortControllerRef.current?.abort();
				return;
			}
			if (state.cacheVersion !== previousState.cacheVersion) {
				beginPrintWait();
				callbackAbortControllerRef.current?.abort();
				void loadDataRef.current(src, state.cacheVersion);
				return;
			}

			const buffer = state.data?.[src];
			const resourceChanged = state.resourceVersions[src] !== previousState.resourceVersions[src];
			const restoredForPrint = isPrint && hasDelivered && !previousState.data?.[src] && !!buffer;
			if (!resourceChanged && !restoredForPrint && (!buffer || hasDelivered)) return;
			if (buffer) {
				deliver(buffer);
				return;
			}
			void loadDataRef.current(src, state.cacheVersion);
		});

		const state = store?.getState();
		const cached = state?.data?.[src];
		if (cached) deliver(cached);
		else void loadDataRef.current(src, state?.cacheVersion ?? 0);

		return () => {
			callbackAbortControllerRef.current?.abort();
			finishPrintWait();
			unsubscribe?.();
		};
	}, [src, content, skipLoad, store, id, provider, isPrint, beginPrintWait, finishPrintWait]);
};
