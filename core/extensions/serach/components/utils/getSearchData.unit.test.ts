import type Url from "@core-ui/ApiServices/Types/Url";
import { makeArticleResult } from "@ext/serach/components/model/__tests__/fixtures";
import { SearchRequestError } from "@ext/serach/components/model/searchRequestError";
import { getSearchData } from "@ext/serach/components/utils/getSearchData";
import type { SearchResult } from "@ext/serach/Searcher";

const mockFetch = jest.fn();

jest.mock("@core-ui/ApiServices/FetchService", () => ({
	// biome-ignore lint/style/useNamingConvention: ESM interop flag
	__esModule: true,
	default: { fetch: (...args: unknown[]) => mockFetch(...args) },
}));

const respond = (ok: boolean, status: number, results: SearchResult[] = []) =>
	mockFetch.mockResolvedValue({ ok, status, json: async () => results });

const run = (signal = new AbortController().signal) =>
	getSearchData({
		url: "search" as unknown as Url,
		signal,
		resourceFilter: "with",
		onlyArticles: true,
	});

describe("getSearchData", () => {
	beforeEach(() => mockFetch.mockReset());

	it("returns the rows of a successful response", async () => {
		respond(true, 200, [makeArticleResult("docs/a.md")]);

		await expect(run()).resolves.toHaveLength(1);
	});

	it("throws on a failed response", async () => {
		respond(false, 500);

		await expect(run()).rejects.toBeInstanceOf(SearchRequestError);
	});

	it("throws on a server-side abort the client did not ask for", async () => {
		respond(false, 499);

		await expect(run()).rejects.toBeInstanceOf(SearchRequestError);
	});

	it("stays quiet when the caller aborted", async () => {
		respond(false, 500);
		const controller = new AbortController();
		controller.abort();

		await expect(run(controller.signal)).resolves.toBeUndefined();
	});
});
