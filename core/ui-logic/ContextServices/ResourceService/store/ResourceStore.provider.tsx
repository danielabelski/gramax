import Path from "@core/FileProvider/Path/Path";
import FetchService from "@core-ui/ApiServices/FetchService";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import {
	createResourceStore,
	type ResourceStoreState,
} from "@core-ui/ContextServices/ResourceService/store/ResourceStore";
import {
	checkLfsPointer,
	loadInternalData,
	type ResourceFetchResult,
} from "@core-ui/ContextServices/ResourceService/utils/utils";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import type { ArticleProviderType } from "@ext/articleProvider/logic/ArticleProvider";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

type SetResource = (name: string, file: string | Buffer, path?: string, force?: boolean) => Promise<string>;

type DeleteResource = (src: string) => Promise<void>;

type ResourceData = Record<string, Buffer>;

export interface ResourceServiceType {
	data: ResourceData;
	id?: string;
	provider?: ArticleProviderType;
	getResource: (src: string) => Promise<ResourceFetchResult>;
	setResource: SetResource;
	deleteResource: DeleteResource;
	getBuffer: (src: string) => Buffer;
	clear: () => void;
	update: (src: string, buffer: Buffer) => void;
}

export const ResourceServiceContext = createContext<ResourceServiceType>({
	data: {},
	id: undefined,
	provider: undefined,
	getResource: () => Promise.resolve({}),
	deleteResource: () => Promise.resolve(),
	setResource: () => Promise.resolve(""),
	getBuffer: () => Buffer.from(""),
	clear: () => {},
	update: () => {},
});

export type ResourceStoreApi = ReturnType<typeof createResourceStore>;

const ResourceStoreContext = createContext<ResourceStoreApi>(undefined);

export interface ResourceStoreProviderProps {
	children: ReactNode;
	id?: string;
	provider?: ArticleProviderType;
}

interface ResourceServiceProviderProps {
	children: ReactNode;
	id?: string;
	provider?: ArticleProviderType;
}

const ResourceServiceProvider = ({ children, id, provider }: ResourceServiceProviderProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const catalogName = useCatalogPropsStore((state) => state.data?.name);

	const store = useResourceStoreContext();
	const update = useResourceStore((state) => state.update);
	const get = useResourceStore((state) => state.get);
	const clear = useResourceStore((state) => state.clear);

	// biome-ignore lint/correctness/useExhaustiveDependencies: apiUrlCreator comes from context and changes per catalog; dropping it would leave a stale creator in the closure
	const setResource: SetResource = useCallback(
		async (name, file, path, force) => {
			const fullResourcePath = new Path([path, name]);
			const url = apiUrlCreator.setArticleResource(fullResourcePath.value, id, provider, force);

			const res = await FetchService.fetch(url, { data: file } as unknown as BodyInit, MimeTypes.text);
			if (!res.ok) return;

			const json = await res.json();

			update(json.path, typeof file === "string" ? Buffer.from(file) : file);
			return json.path;
		},
		[apiUrlCreator, update, provider, id],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: apiUrlCreator comes from context and changes per catalog; dropping it would leave a stale creator in the closure
	const deleteResource: DeleteResource = useCallback(
		async (src: string) => {
			const url = apiUrlCreator.deleteArticleResource(src, id, provider);
			await FetchService.fetch(url);
		},
		[apiUrlCreator, provider, id],
	);

	const getBuffer = useCallback(
		(src: string): Buffer => {
			return get(src);
		},
		[get],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: apiUrlCreator comes from context and changes per catalog; dropping it would leave a stale creator in the closure
	const getResource = useCallback(
		async (src: string): Promise<ResourceFetchResult> => {
			const cached = get(src);

			if (cached) {
				const lfsError = checkLfsPointer(cached, src);
				if (lfsError) return { error: lfsError };
				return { buffer: cached };
			}

			return loadInternalData({
				src,
				apiUrlCreator,
				catalogName,
				id,
				provider,
			});
		},
		[id, provider, catalogName, apiUrlCreator, get],
	);
	const value = useMemo<ResourceServiceType>(
		() => ({
			get data() {
				return store.getState().data;
			},
			id,
			provider,
			getResource,
			setResource,
			deleteResource,
			getBuffer,
			clear,
			update,
		}),
		[store, id, provider, getResource, setResource, deleteResource, getBuffer, clear, update],
	);

	return <ResourceServiceContext.Provider value={value}>{children}</ResourceServiceContext.Provider>;
};

export const ResourceStoreProvider = (props: ResourceStoreProviderProps) => {
	const { children, id, provider } = props;
	const catalogName = useCatalogPropsStore((state) => state.data?.name);
	const storeRef = useRef<ResourceStoreApi>(null);
	const scopeRef = useRef({ catalogName, id, provider });

	if (storeRef.current === null) {
		storeRef.current = createResourceStore({ id, provider });
	}

	// Resource buffers are cached by path, and the store outlives navigation. A file replaced outside the app
	// while the user was in another catalog would otherwise keep showing its cached version, so drop the cache
	// whenever the catalog changes — including on the way back into it.
	useEffect(() => {
		const previousScope = scopeRef.current;
		if (previousScope.id === id && previousScope.provider === provider && previousScope.catalogName === catalogName)
			return;
		scopeRef.current = { catalogName, id, provider };
		storeRef.current.getState().reset(id, provider);
	}, [id, provider, catalogName]);

	return (
		<ResourceStoreContext.Provider value={storeRef.current}>
			<ResourceServiceProvider id={id} provider={provider}>
				{children}
			</ResourceServiceProvider>
		</ResourceStoreContext.Provider>
	);
};

export const useResourceStore = <T,>(
	selector: (store: ResourceStoreState) => T,
	equalityFn?: ((a: T, b: T) => boolean) | "shallow",
): T => {
	const resourceStoreContext = useContext(ResourceStoreContext);

	if (!resourceStoreContext) {
		// Made for compatibility with the previous version of the context, which was called outside its context
		// Ideally, this should be investigated and fixed
		return selector({ data: undefined } as ResourceStoreState);
	}

	const actualEqualityFn = equalityFn === "shallow" ? shallow : equalityFn;

	return useStoreWithEqualityFn(resourceStoreContext, selector, actualEqualityFn);
};

export const useResourceStoreContext = () => useContext(ResourceStoreContext);
