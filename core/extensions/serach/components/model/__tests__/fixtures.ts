import type Style from "@components/HomePage/Cards/model/Style";
import type { NDJsonReadStream } from "@core/utils/readNDJson";
import { type Property, PropertyTypes } from "@ext/properties/models";
import type { SearchGateway } from "@ext/serach/components/model/searchGateway";
import type { SearchParams, SearchParamsInput } from "@ext/serach/components/model/searchParams";
import type { FilterablePropertyItem } from "@ext/serach/components/propertyFilter/propertyFilterModel";
import type { SearchArticleResult, SearchCatalogResult, SearchResult } from "@ext/serach/Searcher";
import { buildArticleRows, type RowSearchResult } from "@ext/serach/utils/SearchRowsModel";

export const makeProperty = (id: string, type = PropertyTypes.enum, values = ["a", "b"]): Property => ({
	id,
	name: id,
	type,
	style: {} as Style,
	values,
});

export const makeSelectedProperty = (id: string, selectedValues: string[], emptySelected = false) => {
	const property = makeProperty(id);
	const item: FilterablePropertyItem = {
		property,
		shown: true,
		selection: {
			options: property.values.map((value) => ({
				value,
				selected: selectedValues.includes(value),
				shown: true,
			})),
			emptySelected,
			allSelected: property.values.every((value) => selectedValues.includes(value)),
		},
	};
	return item;
};

export const makeParamsInput = (overrides: Partial<SearchParamsInput> = {}): SearchParamsInput => ({
	mode: "catalog",
	scope: "catalog",
	aiEnabled: false,
	catalogName: "docs",
	catalogDefaultLanguage: undefined,
	currentArticleLanguage: undefined,
	currentArticleRefPath: undefined,
	sectionCatalogNames: undefined,
	resourceFilter: "with",
	resourcesEnabled: false,
	selectedProperties: [],
	...overrides,
});

export const makeParams = (overrides: Partial<SearchParams> = {}): SearchParams => ({
	aiEnabled: false,
	onlyArticles: true,
	...overrides,
});

export const makeArticleResult = (url: string, paragraphs: string[] = ["text"]): SearchArticleResult => ({
	type: "article",
	url,
	refPath: url,
	isRecommended: false,
	title: [{ type: "text", text: url }],
	properties: [],
	breadcrumbs: [],
	catalog: { name: "docs", title: "Docs", url: "/docs" },
	items: paragraphs.map((text) => ({
		type: "paragraph",
		searchText: text,
		items: [{ type: "text", text }],
	})),
});

export const makeCatalogResult = (name: string): SearchCatalogResult => ({
	type: "catalog",
	name,
	url: `/${name}`,
	title: [{ type: "text", text: name }],
});

export const makeRows = (results: SearchResult[]): RowSearchResult[] => buildArticleRows(results).rows;

export interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
}

export const deferred = <T>(): Deferred<T> => {
	let resolve: (value: T) => void;
	let reject: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

export interface FakeGateway extends SearchGateway {
	search: jest.Mock<Promise<RowSearchResult[] | undefined>, [SearchParams, string, AbortSignal]>;
	chat: jest.Mock<Promise<void>, [SearchParams, string, AbortSignal, (text: string) => Promise<void>]>;
	resetIndex: jest.Mock<Promise<void>, [string | undefined]>;
	indexingProgress: jest.Mock;
	chatAvailable: jest.Mock<Promise<boolean>, []>;
	lastSignal(): AbortSignal;
	emitChatChunk(text: string): Promise<void>;
	/** Ends the chat stream, the way the real gateway resolves once the response is complete. */
	endChatStream(): void;
}

export const createFakeGateway = (): FakeGateway => {
	let chunkSink: ((text: string) => Promise<void>) | undefined;
	let endStream: (() => void) | undefined;

	const gateway = {
		search: jest.fn(async () => [] as RowSearchResult[]),
		// Mirrors chatStream: the promise stays pending for as long as the response streams.
		chat: jest.fn((_params: SearchParams, _query: string, _signal: AbortSignal, onChunk) => {
			chunkSink = onChunk;
			return new Promise<void>((resolve) => {
				endStream = resolve;
			});
		}),
		resetIndex: jest.fn(async () => {}),
		indexingProgress: jest.fn(async () => undefined),
		chatAvailable: jest.fn(async () => true),
		lastSignal: () => lastSignalOf(gateway.search, gateway.chat, gateway.indexingProgress),
		emitChatChunk: (text: string) => chunkSink(text),
		endChatStream: () => endStream?.(),
	} as unknown as FakeGateway;

	return gateway;
};

// Signals are read back from the recorded calls so a test may replace any mock
// implementation without losing them.
const lastSignalOf = (...mocks: jest.Mock[]): AbortSignal | undefined => {
	const calls = mocks.flatMap((mock) =>
		mock.mock.calls.map((args, index) => ({
			order: mock.mock.invocationCallOrder[index],
			signal: args.find((arg) => arg instanceof AbortSignal) as AbortSignal,
		})),
	);

	return calls.sort((a, b) => a.order - b.order).at(-1)?.signal;
};

type StreamChunk = { value?: Uint8Array; done: boolean };

export interface FakeNdjsonStream {
	reader: NDJsonReadStream;
	push(item: unknown): Promise<void>;
	close(): Promise<void>;
	cancelled(): boolean;
}

export const createNdjsonStream = (): FakeNdjsonStream => {
	const encoder = new TextEncoder();
	const buffered: StreamChunk[] = [];
	let waiting: ((chunk: StreamChunk) => void) | undefined;
	let cancelled = false;

	const emit = (chunk: StreamChunk) => {
		if (!waiting) return void buffered.push(chunk);
		const resolve = waiting;
		waiting = undefined;
		resolve(chunk);
	};

	const reader = {
		read: () => {
			if (buffered.length) return Promise.resolve(buffered.shift());
			return new Promise<StreamChunk>((resolve) => {
				waiting = resolve;
			});
		},
		cancel: async () => {
			cancelled = true;
		},
	} as unknown as NDJsonReadStream;

	return {
		reader,
		push: async (item) => {
			emit({ value: encoder.encode(`${JSON.stringify(item)}\n`), done: false });
			await Promise.resolve();
		},
		close: async () => {
			emit({ done: true });
			await Promise.resolve();
		},
		cancelled: () => cancelled,
	};
};
