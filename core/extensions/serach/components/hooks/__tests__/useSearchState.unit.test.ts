/** biome-ignore-all lint/style/useNamingConvention: __esModule is jest's ESM interop flag */
import type { Section } from "@core/SitePresenter/SitePresenter";
import { ContentLanguage } from "@ext/localization/core/model/Language";
import { PropertyTypes } from "@ext/properties/models";
import { type SearchNormalState, type SearchState, useSearchState } from "@ext/serach/components/hooks/useSearchState";
import { WorkspaceView } from "@ext/workspace/WorkspaceConfig";
import { act, renderHook } from "@testing-library/react";
import { env, resetSearchEnv } from "../../__tests__/searchEnv";
import {
	createNdjsonStream,
	type Deferred,
	deferred,
	type FakeNdjsonStream,
	makeArticleResult,
	makeProperty,
	makeRows,
} from "../../model/__tests__/fixtures";

jest.mock("@ext/serach/components/SearchQueryContext", () => ({
	__esModule: true,
	default: {
		get value() {
			return jest
				.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv")
				.useSearchQueryContext();
		},
	},
}));
jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({ useApiUrlCreator: () => ({}) }));
jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	__esModule: true,
	default: {
		get value() {
			return jest
				.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv")
				.pageDataContext();
		},
	},
}));
jest.mock("@core-ui/hooks/usePlatform", () => ({
	usePlatform: () =>
		jest.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv").platformFlags(),
}));
jest.mock("@ext/properties/components/PropertyService", () => ({
	__esModule: true,
	default: {
		get value() {
			return {
				properties:
					jest.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv").env
						.properties,
			};
		},
	},
}));
jest.mock("@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider", () => ({
	useCatalogPropsStore: (selector: (s: unknown) => unknown) => {
		const { env } = jest.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv");
		return selector({ data: { name: env.catalogName, language: env.catalogDefaultLanguage } });
	},
}));
jest.mock("@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider", () => ({
	useArticlePropsStore: (selector: (s: unknown) => unknown) => {
		const { env } = jest.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv");
		return selector({ data: { pathname: env.currentPathname, ref: { path: env.currentArticleRefPath } } });
	},
}));
jest.mock("@core/Api/useRouter", () => ({
	useRouter: () => ({
		setUrl: (...args: unknown[]) =>
			jest
				.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv")
				.env.navigate(...args),
	}),
}));
jest.mock("@ext/serach/components/model/searchGateway", () => ({
	createSearchGateway: () =>
		jest.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv").env.gateway,
}));
jest.mock("@ext/errorHandlers/client/ErrorConfirmService", () => ({
	__esModule: true,
	default: {
		notify: (...args: unknown[]) =>
			jest
				.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv")
				.env.notifyError(...args),
	},
}));
jest.mock("@plugins/api/events", () => ({
	emitPluginEvent: (...args: unknown[]) =>
		jest
			.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv")
			.env.emitPluginEvent(...args),
}));
jest.mock("@components/Article/SearchHandler/ArticleSearchFragmentHander", () => ({
	highlightFragmentInEditor: (...args: unknown[]) =>
		jest
			.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv")
			.env.highlightInEditor(...args),
	highlightFragmentInDocportal: (...args: unknown[]) =>
		jest
			.requireActual<typeof import("../../__tests__/searchEnv")>("../../__tests__/searchEnv")
			.env.highlightInDocportal(...args),
}));

const DEBOUNCE = 400;
const CHAT_DEBOUNCE = DEBOUNCE * 2;
const rows = makeRows([makeArticleResult("docs/a.md")]);
const otherRows = makeRows([makeArticleResult("docs/b.md")]);

const folderSection = { view: WorkspaceView.folder, catalogLinks: [{ name: "a" }, { name: "b" }] } as Section;

const render = (args: Parameters<typeof useSearchState>[0] = { isHomePage: false }) =>
	renderHook((props: Parameters<typeof useSearchState>[0]) => useSearchState(props), { initialProps: args });

const settle = () => act(async () => {});
const advance = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

const open = async (result: { current: SearchState }) => {
	act(() => result.current.dialog.setOpen(true));
	await settle();
};

const type = async (result: { current: SearchState }, query: string) => {
	act(() => result.current.query.set(query));
	advance(DEBOUNCE);
	await settle();
};

const normal = (state: SearchState) => state as SearchNormalState;

const searchQueries = () => env.gateway.search.mock.calls.map(([, query]) => query);

const startIndexing = (): FakeNdjsonStream => {
	const ndjson = createNdjsonStream();
	env.gateway.indexingProgress.mockResolvedValue(ndjson.reader);
	return ndjson;
};

const push = (ndjson: FakeNdjsonStream, item: unknown) => act(() => ndjson.push(item));

beforeEach(() => {
	jest.useFakeTimers();
	resetSearchEnv();
	env.gateway.search.mockResolvedValue(rows);
});

afterEach(() => jest.useRealTimers());

describe("useSearchState", () => {
	describe("normal search", () => {
		it("does not reach the backend while the dialog is closed", async () => {
			const { result } = render();

			await type(result, "hello");

			expect(env.gateway.search).not.toHaveBeenCalled();
			// Status only matters inside the open dialog; with a query and no data it reads as loading.
			expect(result.current.status).toBe("loading");
		});

		it("does not search an empty query", async () => {
			const { result } = render();

			await open(result);

			expect(env.gateway.search).not.toHaveBeenCalled();
			expect(result.current.status).toBe("help");
		});

		it("searches once the typing settles and exposes the rows", async () => {
			const { result } = render();
			await open(result);

			act(() => result.current.query.set("hello"));
			expect(env.gateway.search).not.toHaveBeenCalled();

			advance(DEBOUNCE);
			await settle();

			expect(searchQueries()).toEqual(["hello"]);
			expect(result.current.status).toBe("results");
			expect(normal(result.current).data).toHaveLength(1);
		});

		it("sends the catalog scope the dialog opened in", async () => {
			const { result } = render();
			await open(result);

			await type(result, "hello");

			expect(env.gateway.search).toHaveBeenCalledWith(
				expect.objectContaining({ catalogName: "docs", onlyArticles: true, aiEnabled: false }),
				"hello",
				expect.any(AbortSignal),
			);
		});

		it("reports no results as empty", async () => {
			env.gateway.search.mockResolvedValue([]);
			const { result } = render();
			await open(result);

			await type(result, "hello");

			expect(result.current.status).toBe("empty");
		});

		it("collapses a burst of typing into one search", async () => {
			const { result } = render();
			await open(result);

			act(() => result.current.query.set("h"));
			advance(100);
			act(() => result.current.query.set("he"));
			advance(100);
			act(() => result.current.query.set("hel"));
			advance(DEBOUNCE);
			await settle();

			expect(searchQueries()).toEqual(["hel"]);
		});
	});

	describe("changing the query mid-flight", () => {
		let pending: Deferred<typeof rows>;

		beforeEach(() => {
			pending = deferred();
			env.gateway.search.mockReturnValueOnce(pending.promise).mockResolvedValue(otherRows);
		});

		it("aborts the running search and issues the new one", async () => {
			const { result } = render();
			await open(result);
			await type(result, "first");
			const firstSignal = env.gateway.search.mock.calls[0][2];

			await type(result, "second");

			expect(firstSignal.aborted).toBe(true);
			expect(searchQueries()).toEqual(["first", "second"]);
		});

		it("ignores the abandoned response when it finally lands", async () => {
			const { result } = render();
			await open(result);
			await type(result, "first");
			await type(result, "second");

			await act(async () => {
				pending.resolve(rows);
			});

			expect(normal(result.current).data[0].rawResult.url).toBe("docs/b.md");
		});

		it("searches again when the query returns to its settled value", async () => {
			env.gateway.search.mockReset().mockResolvedValue(rows);
			const { result } = render();
			await open(result);
			await type(result, "hello");

			act(() => result.current.query.set("hell"));
			advance(100);
			act(() => result.current.query.set("hello"));
			advance(DEBOUNCE);
			await settle();

			expect(searchQueries()).toEqual(["hello", "hello"]);
		});

		it("shows the loader while the next query is still being typed", async () => {
			env.gateway.search.mockReset().mockResolvedValue(rows);
			const { result } = render();
			await open(result);
			await type(result, "hello");

			act(() => result.current.query.set("hello world"));
			advance(DEBOUNCE / 2);

			expect(result.current.status).toBe("loading");
			expect(env.gateway.search).toHaveBeenCalledTimes(1);
		});
	});

	describe("closing the dialog", () => {
		it("aborts a search that is still running", async () => {
			const pending = deferred<typeof rows>();
			env.gateway.search.mockReturnValue(pending.promise);
			const { result } = render();
			await open(result);
			await type(result, "hello");

			act(() => result.current.dialog.setOpen(false));

			expect(env.gateway.search.mock.calls[0][2].aborted).toBe(true);
		});

		it("keeps the results it already had", async () => {
			const { result } = render();
			await open(result);
			await type(result, "hello");

			act(() => result.current.dialog.setOpen(false));

			expect(result.current.status).toBe("results");
		});

		it("does not repeat a search that already answered when reopened", async () => {
			const { result } = render();
			await open(result);
			await type(result, "hello");

			act(() => result.current.dialog.setOpen(false));
			await open(result);

			expect(env.gateway.search).toHaveBeenCalledTimes(1);
		});

		it("refetches when reopened with a searchable query but nothing to show", async () => {
			const pending = deferred<typeof rows>();
			env.gateway.search.mockReturnValueOnce(pending.promise).mockResolvedValue(rows);
			const { result } = render();
			await open(result);
			await type(result, "hello");
			act(() => result.current.dialog.setOpen(false));

			await open(result);

			expect(searchQueries()).toEqual(["hello", "hello"]);
			expect(result.current.status).toBe("results");
		});

		it("does not repeat an ai answer that finished streaming", async () => {
			env.platform = "static";
			env.aiEnabled = true;
			const { result } = render();
			await open(result);
			act(() => result.current.ai.toggle());
			act(() => result.current.query.set("why"));
			advance(CHAT_DEBOUNCE);
			await settle();
			await act(() => env.gateway.emitChatChunk("done"));
			await act(async () => env.gateway.endChatStream());

			act(() => result.current.dialog.setOpen(false));
			await open(result);

			expect(env.gateway.chat).toHaveBeenCalledTimes(1);
		});

		it("refetches an aborted ai answer when reopened", async () => {
			env.platform = "static";
			env.aiEnabled = true;
			const { result } = render();
			await open(result);
			act(() => result.current.ai.toggle());
			act(() => result.current.query.set("why"));
			advance(CHAT_DEBOUNCE);
			await settle();
			expect(env.gateway.chat).toHaveBeenCalledTimes(1);

			act(() => result.current.dialog.setOpen(false));
			await open(result);

			expect(env.gateway.chat).toHaveBeenCalledTimes(2);
		});
	});

	describe("ai search", () => {
		beforeEach(() => {
			env.platform = "static";
			env.aiEnabled = true;
		});

		it("is unavailable until the server confirms it", async () => {
			const available = deferred<boolean>();
			env.gateway.chatAvailable.mockReturnValue(available.promise);
			const { result } = render();

			expect(result.current.ai.available).toBe(false);

			await act(async () => {
				available.resolve(true);
			});

			expect(result.current.ai.available).toBe(true);
		});

		it("cannot be turned on while unavailable", async () => {
			env.gateway.chatAvailable.mockResolvedValue(false);
			const { result } = render();
			await settle();

			act(() => result.current.ai.toggle());

			expect(result.current.aiEnabled).toBe(false);
		});

		it("streams the answer, growing it with each chunk", async () => {
			const { result } = render();
			await open(result);
			act(() => result.current.ai.toggle());

			act(() => result.current.query.set("why"));
			advance(CHAT_DEBOUNCE);
			await settle();
			await act(() => env.gateway.emitChatChunk("first "));
			const afterFirst = (result.current as { data: unknown }).data;
			await act(() => env.gateway.emitChatChunk("second"));

			expect(env.gateway.chat).toHaveBeenCalledWith(
				expect.objectContaining({ aiEnabled: true }),
				"why",
				expect.any(AbortSignal),
				expect.any(Function),
			);
			expect(env.gateway.search).not.toHaveBeenCalled();
			expect(afterFirst).not.toBeNull();
			expect((result.current as { data: unknown }).data).not.toBe(afterFirst);
		});

		it("waits longer than a normal search before asking", async () => {
			const { result } = render();
			await open(result);
			act(() => result.current.ai.toggle());

			act(() => result.current.query.set("why"));
			advance(DEBOUNCE);
			await settle();
			expect(env.gateway.chat).not.toHaveBeenCalled();

			advance(DEBOUNCE);
			await settle();
			expect(env.gateway.chat).toHaveBeenCalledTimes(1);
		});

		it("aborts the stream in progress when the query changes", async () => {
			const { result } = render();
			await open(result);
			act(() => result.current.ai.toggle());
			act(() => result.current.query.set("why"));
			advance(CHAT_DEBOUNCE);
			await settle();
			await act(() => env.gateway.emitChatChunk("partial"));
			const firstSignal = env.gateway.chat.mock.calls[0][2];

			act(() => result.current.query.set("why not"));
			advance(CHAT_DEBOUNCE);
			await settle();

			expect(firstSignal.aborted).toBe(true);
			expect(env.gateway.chat).toHaveBeenCalledTimes(2);
			expect((result.current as { data: unknown }).data).toBeNull();
		});

		it("drops a chunk that arrives after the stream was abandoned", async () => {
			const { result } = render();
			await open(result);
			act(() => result.current.ai.toggle());
			act(() => result.current.query.set("why"));
			advance(CHAT_DEBOUNCE);
			await settle();
			const abandoned = env.gateway.emitChatChunk;

			act(() => result.current.dialog.setOpen(false));
			await act(() => abandoned("late"));

			expect((result.current as { data: unknown }).data).toBeNull();
		});

		it("switches back to a normal search when turned off", async () => {
			const { result } = render();
			await open(result);
			act(() => result.current.ai.toggle());
			act(() => result.current.query.set("why"));
			advance(CHAT_DEBOUNCE);
			await settle();

			act(() => result.current.ai.toggle());
			await settle();

			expect(result.current.aiEnabled).toBe(false);
			expect(searchQueries()).toEqual(["why"]);
		});
	});

	describe("changing search parameters", () => {
		it("searches at once instead of waiting out the debounce", async () => {
			const { result } = render();
			await open(result);
			await type(result, "hello");

			act(() => result.current.scope.set("all"));
			await settle();

			expect(searchQueries()).toEqual(["hello", "hello"]);
			expect(env.gateway.search).toHaveBeenLastCalledWith(
				expect.objectContaining({ catalogName: undefined, onlyArticles: false }),
				"hello",
				expect.any(AbortSignal),
			);
		});

		it("applies a query that was still being typed", async () => {
			const { result } = render();
			await open(result);

			act(() => result.current.query.set("hello"));
			act(() => result.current.scope.set("all"));
			await settle();

			expect(searchQueries()).toEqual(["hello"]);
		});

		it("refetches when the resource filter changes", async () => {
			env.resourcesEnabled = true;
			const { result } = render();
			await open(result);
			await type(result, "hello");

			act(() => normal(result.current).resourceFilter.set("only"));
			await settle();

			expect(env.gateway.search).toHaveBeenLastCalledWith(
				expect.objectContaining({ resourceFilter: "only" }),
				"hello",
				expect.any(AbortSignal),
			);
		});

		it("searches an empty query once a property filter is chosen", async () => {
			env.properties = new Map([["status", makeProperty("status", PropertyTypes.enum, ["open"])]]);
			const { result } = render();
			await open(result);
			expect(env.gateway.search).not.toHaveBeenCalled();

			act(() => normal(result.current).property.controllers[0].toggleValue("open"));
			await settle();

			expect(env.gateway.search).toHaveBeenCalledWith(
				expect.objectContaining({
					propertyFilter: { op: "and", filters: [{ op: "contains", key: "status", list: ["open"] }] },
				}),
				"",
				expect.any(AbortSignal),
			);
		});

		it("goes back to the help screen when a scope drops the only filter in play", async () => {
			env.properties = new Map([["status", makeProperty("status", PropertyTypes.enum, ["open"])]]);
			const { result } = render();
			await open(result);
			act(() => normal(result.current).property.controllers[0].toggleValue("open"));
			await settle();

			act(() => result.current.scope.set("all"));
			await settle();

			expect(env.gateway.search).toHaveBeenCalledTimes(1);
			expect(result.current.status).toBe("help");
			expect(normal(result.current).property).toBeUndefined();
		});

		it("sends the folder catalogs in a workspace section", async () => {
			const { result } = render({ isHomePage: true, section: folderSection });
			await open(result);

			await type(result, "hello");

			expect(env.gateway.search).toHaveBeenCalledWith(
				expect.objectContaining({ catalogNames: ["a", "b"] }),
				"hello",
				expect.any(AbortSignal),
			);
		});

		it("sends the article language of the open article", async () => {
			env.currentArticleLanguage = ContentLanguage.ru;
			env.catalogDefaultLanguage = ContentLanguage.en;
			const { result } = render();
			await open(result);

			await type(result, "hello");

			expect(env.gateway.search).toHaveBeenCalledWith(
				expect.objectContaining({ articlesLanguage: "ru" }),
				"hello",
				expect.any(AbortSignal),
			);
		});
	});

	describe("indexing", () => {
		beforeEach(() => {
			env.platform = "web";
		});

		it("rebuilds the local index when the dialog opens", async () => {
			const { result } = render();

			await open(result);

			expect(env.gateway.resetIndex).toHaveBeenCalledWith("docs");
		});

		it("leaves a remote index alone", async () => {
			env.platform = "next";
			const { result } = render();

			await open(result);

			expect(env.gateway.resetIndex).not.toHaveBeenCalled();
		});

		it("searches against the rebuilt index once indexing completes", async () => {
			const ndjson = startIndexing();
			const { result } = render();
			await open(result);
			await type(result, "hello");
			expect(env.gateway.search).toHaveBeenCalledTimes(1);

			await push(ndjson, { type: "progress", progress: 0.5 });
			expect(result.current.indexing).toEqual({ inProgress: true, progress: 0.5 });

			await push(ndjson, { type: "done" });
			await settle();

			expect(result.current.indexing).toEqual({ inProgress: false, progress: 1 });
			expect(searchQueries()).toEqual(["hello", "hello"]);
		});

		it("does not search again for each done an idle stream repeats", async () => {
			const ndjson = startIndexing();
			const { result } = render();
			await open(result);
			await type(result, "hello");

			for (let beat = 0; beat < 5; beat++) await push(ndjson, { type: "done" });
			await settle();

			expect(searchQueries()).toEqual(["hello"]);
			expect(result.current.indexing).toEqual({ inProgress: false, progress: 1 });
		});

		it("searches once per finished indexing run, not once per done that follows it", async () => {
			const ndjson = startIndexing();
			const { result } = render();
			await open(result);
			await type(result, "hello");

			await push(ndjson, { type: "progress", progress: 0.5 });
			await push(ndjson, { type: "done" });
			await settle();
			for (let beat = 0; beat < 5; beat++) await push(ndjson, { type: "done" });
			await settle();

			expect(searchQueries()).toEqual(["hello", "hello"]);
		});

		it("searches again for a second indexing run", async () => {
			const ndjson = startIndexing();
			const { result } = render();
			await open(result);
			await type(result, "hello");

			await push(ndjson, { type: "progress", progress: 0.5 });
			await push(ndjson, { type: "done" });
			await settle();
			await push(ndjson, { type: "progress", progress: 0.2 });
			await push(ndjson, { type: "done" });
			await settle();

			expect(searchQueries()).toEqual(["hello", "hello", "hello"]);
		});

		it("does not search while the stream beats on with nothing typed", async () => {
			const ndjson = startIndexing();
			const { result } = render();
			await open(result);

			for (let beat = 0; beat < 5; beat++) await push(ndjson, { type: "done" });
			await settle();

			expect(env.gateway.search).not.toHaveBeenCalled();
			expect(result.current.status).toBe("help");
		});
	});

	describe("failures", () => {
		it("reports the error and stops showing a spinner", async () => {
			const failure = new Error("backend is down");
			env.gateway.search.mockRejectedValue(failure);
			const { result } = render();
			await open(result);

			await type(result, "hello");

			expect(result.current.status).toBe("error");
			expect(env.notifyError).toHaveBeenCalledWith(failure);
		});

		it("recovers on the next query", async () => {
			env.gateway.search.mockRejectedValueOnce(new Error("backend is down")).mockResolvedValue(rows);
			const { result } = render();
			await open(result);
			await type(result, "hello");

			await type(result, "hello world");

			expect(result.current.status).toBe("results");
		});
	});

	describe("opening a result", () => {
		it("navigates, closes the dialog and reports the click", async () => {
			const { result } = render();
			await open(result);
			await type(result, "hello");
			act(() => normal(result.current).focus.move(1));

			act(() => normal(result.current).focus.current.onClick());

			expect(env.navigate).toHaveBeenCalledTimes(1);
			expect(result.current.dialog.open).toBe(false);
		});

		it("highlights the fragment when the hit is in the article already open", async () => {
			env.platform = "static";
			env.currentPathname = "docs/a.md";
			const { result } = render();
			await open(result);
			await type(result, "hello");
			act(() => normal(result.current).focus.move(1));
			act(() => normal(result.current).focus.move(1));

			act(() => normal(result.current).focus.current.onClick());

			expect(env.highlightInDocportal).toHaveBeenCalledWith("text", 0);
		});
	});

	describe("clearing", () => {
		it("drops the query and keeps the chosen properties", async () => {
			env.properties = new Map([["status", makeProperty("status", PropertyTypes.enum, ["open"])]]);
			const { result } = render();
			await open(result);
			act(() => normal(result.current).property.controllers[0].toggleValue("open"));
			await type(result, "hello");

			act(() => result.current.clear());
			await settle();

			expect(result.current.query.value).toBe("");
			expect(normal(result.current).property.selected).toHaveLength(1);
			expect(result.current.status).not.toBe("help");
		});

		it("resets the chosen properties on their own control", async () => {
			env.properties = new Map([["status", makeProperty("status", PropertyTypes.enum, ["open"])]]);
			const { result } = render();
			await open(result);
			act(() => normal(result.current).property.controllers[0].toggleValue("open"));
			await settle();

			act(() => normal(result.current).property.clearFilteredProperties());
			await settle();

			expect(normal(result.current).property.selected).toEqual([]);
			expect(result.current.status).toBe("help");
		});
	});

	describe("hotkeys", () => {
		const press = (code: string) =>
			act(
				() =>
					void document.dispatchEvent(
						new KeyboardEvent("keydown", { code, ctrlKey: true, cancelable: true }),
					),
			);

		it("ctrl+slash opens and closes the dialog", async () => {
			const { result } = render();

			press("Slash");
			expect(result.current.dialog.open).toBe(true);

			press("Slash");
			expect(result.current.dialog.open).toBe(false);
		});

		it("ctrl+enter walks the scope and searches the new one right away", async () => {
			const { result } = render();
			await open(result);
			await type(result, "hello");

			press("Enter");
			await settle();

			expect(result.current.scope.value).toBe("article");
			expect(searchQueries()).toEqual(["hello", "hello"]);
		});

		it("ctrl+enter does nothing on the home page", async () => {
			const { result } = render({ isHomePage: true });
			await open(result);

			press("Enter");
			await settle();

			expect(result.current.scope.value).toBe("all");
		});
	});

	describe("opened from elsewhere", () => {
		it("opens at the scope the caller asked for", async () => {
			env.openRequest = { has: true, scope: "article" };
			env.currentArticleRefPath = "docs/a.md";
			const { result } = render();
			await settle();

			expect(result.current.dialog.open).toBe(true);
			expect(result.current.scope.value).toBe("article");

			await type(result, "hello");

			expect(env.gateway.search).toHaveBeenCalledWith(
				expect.objectContaining({ articleRefFilter: "docs/a.md" }),
				"hello",
				expect.any(AbortSignal),
			);
		});

		it("ignores the requested scope on the home page", async () => {
			env.openRequest = { has: true, scope: "article" };
			const { result } = render({ isHomePage: true });
			await settle();

			expect(result.current.dialog.open).toBe(true);
			expect(result.current.scope.value).toBe("all");
		});
	});

	describe("analytics", () => {
		const payloadOf = (event: string) => env.emitPluginEvent.mock.calls.find(([name]) => name === event)?.[1];

		it("reports the search and then the click on a result", async () => {
			const { result } = render();
			await open(result);
			await type(result, "hello");

			expect(payloadOf("search:start")).toEqual({
				query: "hello",
				searchSessionId: expect.any(String),
				catalogName: "docs",
				onSuccess: expect.any(Function),
			});

			act(() => payloadOf("search:start").onSuccess(7));
			expect(payloadOf("search:results")).toEqual({
				searchAnalyticsId: 7,
				results: [expect.objectContaining({ url: "docs/a.md", position: 1 })],
			});

			act(() => normal(result.current).focus.move(1));
			act(() => normal(result.current).focus.current.onClick());

			expect(payloadOf("search:click")).toEqual({ searchAnalyticsId: 7, articleUrl: "docs/a.md" });
		});

		it("reports nothing while the dialog never opened", async () => {
			const { result } = render();

			await type(result, "hello");

			expect(env.emitPluginEvent).not.toHaveBeenCalled();
		});
	});

	describe("focus", () => {
		it("drops the focused row when new results arrive", async () => {
			const { result } = render();
			await open(result);
			await type(result, "hello");
			act(() => normal(result.current).focus.move(1));
			expect(normal(result.current).focus.current).toBeDefined();

			env.gateway.search.mockResolvedValue(otherRows);
			await type(result, "hello world");

			expect(normal(result.current).focus.current).toBeUndefined();
		});
	});

	describe("home page", () => {
		it("searches every catalog", async () => {
			const { result } = render({ isHomePage: true });
			await open(result);

			await type(result, "hello");

			expect(result.current.scope.value).toBe("all");
			expect(env.gateway.search).toHaveBeenCalledWith(
				expect.objectContaining({ catalogName: undefined, onlyArticles: false }),
				"hello",
				expect.any(AbortSignal),
			);
		});
	});
});
