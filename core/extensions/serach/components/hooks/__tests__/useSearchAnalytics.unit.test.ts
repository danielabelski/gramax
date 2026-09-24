import {
	buildSearchResultsPayload,
	type EmitSearchEvent,
	type UseSearchAnalyticsArgs,
	useSearchAnalytics,
} from "@ext/serach/components/hooks/useSearchAnalytics";
import { act, renderHook } from "@testing-library/react";
import { makeArticleResult, makeCatalogResult, makeRows } from "../../model/__tests__/fixtures";

const rows = makeRows([makeArticleResult("docs/a.md")]);

const render = (open = true) => {
	const emit = jest.fn(async () => {}) as unknown as jest.Mock;
	const result = renderHook((args: UseSearchAnalyticsArgs) => useSearchAnalytics(args), {
		initialProps: { open, emit: emit as unknown as EmitSearchEvent },
	});
	return { ...result, emit };
};

const startPayload = (emit: jest.Mock) => emit.mock.calls.find(([event]) => event === "search:start")?.[1];

const succeedStart = (emit: jest.Mock, analyticsId: number) => startPayload(emit).onSuccess(analyticsId);

describe("useSearchAnalytics", () => {
	describe("session", () => {
		it("attaches a generated session id to the search", () => {
			const { result, emit } = render();

			act(() => result.current.onResults("query", rows, "docs"));

			expect(emit).toHaveBeenCalledWith("search:start", {
				query: "query",
				searchSessionId: expect.any(String),
				catalogName: "docs",
				onSuccess: expect.any(Function),
			});
		});

		it("uses a new session id for each open", () => {
			const { result, rerender, emit } = render();
			act(() => result.current.onResults("query", rows));
			const first = startPayload(emit).searchSessionId;

			rerender({ open: false, emit: emit as unknown as EmitSearchEvent });
			rerender({ open: true, emit: emit as unknown as EmitSearchEvent });
			emit.mockClear();
			act(() => result.current.onResults("query", rows));

			expect(startPayload(emit).searchSessionId).not.toBe(first);
		});

		it("reports nothing while closed", () => {
			const { result, emit } = render(false);

			act(() => result.current.onResults("query", rows));

			expect(emit).not.toHaveBeenCalled();
		});

		it("reports nothing for an empty query", () => {
			const { result, emit } = render();

			act(() => result.current.onResults("", rows));

			expect(emit).not.toHaveBeenCalled();
		});
	});

	describe("results", () => {
		it("emits the ranked result payload once the search is registered", () => {
			const { result, emit } = render();
			act(() => result.current.onResults("query", rows));

			act(() => succeedStart(emit, 42));

			expect(emit).toHaveBeenCalledWith("search:results", {
				searchAnalyticsId: 42,
				results: [
					{
						url: "docs/a.md",
						title: "docs/a.md",
						catalog: "Docs",
						type: "article",
						position: 1,
						isRecommended: false,
					},
				],
			});
		});
	});

	describe("clicks", () => {
		it("reports a click against the registered search", () => {
			const { result, emit } = render();
			act(() => result.current.onResults("query", rows));
			act(() => succeedStart(emit, 42));
			emit.mockClear();

			act(() => result.current.onLinkClick("docs/a.md"));

			expect(emit).toHaveBeenCalledWith("search:click", { searchAnalyticsId: 42, articleUrl: "docs/a.md" });
		});

		it("reports only the first click of a search", () => {
			const { result, emit } = render();
			act(() => result.current.onResults("query", rows));
			act(() => succeedStart(emit, 42));
			act(() => result.current.onLinkClick("docs/a.md"));
			emit.mockClear();

			act(() => result.current.onLinkClick("docs/b.md"));

			expect(emit).not.toHaveBeenCalled();
		});

		it("reports nothing when no search was registered", () => {
			const { result, emit } = render();

			act(() => result.current.onLinkClick("docs/a.md"));

			expect(emit).not.toHaveBeenCalled();
		});

		it("forgets the registered search once the dialog closes", () => {
			const { result, rerender, emit } = render();
			act(() => result.current.onResults("query", rows));
			act(() => succeedStart(emit, 42));

			rerender({ open: false, emit: emit as unknown as EmitSearchEvent });
			emit.mockClear();
			act(() => result.current.onLinkClick("docs/a.md"));

			expect(emit).not.toHaveBeenCalled();
		});
	});
});

describe("buildSearchResultsPayload", () => {
	it("numbers results from one and keeps catalog rows free of article-only fields", () => {
		const rows = makeRows([makeCatalogResult("docs"), makeArticleResult("docs/a.md")]);

		expect(buildSearchResultsPayload(rows)).toEqual([
			{
				url: "/docs",
				title: "docs",
				catalog: undefined,
				type: "catalog",
				position: 1,
				isRecommended: false,
			},
			{
				url: "docs/a.md",
				title: "docs/a.md",
				catalog: "Docs",
				type: "article",
				position: 2,
				isRecommended: false,
			},
		]);
	});

	it("joins a highlighted title back into plain text", () => {
		const result = makeArticleResult("docs/a.md");
		result.title = [
			{ type: "text", text: "Get " },
			{ type: "highlight", text: "started" },
		];

		expect(buildSearchResultsPayload(makeRows([result]))[0].title).toBe("Get started");
	});

	it("carries the recommended flag", () => {
		const result = makeArticleResult("docs/a.md");
		result.isRecommended = true;

		expect(buildSearchResultsPayload(makeRows([result]))[0].isRecommended).toBe(true);
	});

	it("returns nothing for no rows", () => {
		expect(buildSearchResultsPayload([])).toEqual([]);
	});
});
