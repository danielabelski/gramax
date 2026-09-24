import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import ArticleUpdaterService from "./ArticleUpdaterService";

// #910: every flow that changes content on disk (conflict resolution, sync,
// branch switch, the fs watcher) calls `update`. On the workspace home page no
// article is open, so `articlePath` is empty and the request went out anyway —
// `page/getArticlePageData` then received `path === null` and the app crashed.
// The guard is what keeps that request from being sent at all.

jest.mock("@core-ui/ApiServices/FetchService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { fetch: jest.fn() },
}));

const fetchMock = FetchService.fetch as jest.Mock;

const apiUrlCreatorWith = (articlePath: string) =>
	({
		articlePath,
		getArticlePageData: () => "page/getArticlePageData",
	}) as unknown as ApiUrlCreator;

beforeEach(() => {
	fetchMock.mockReset();
	// `update` returns early until a callback is bound, which would mask everything below.
	ArticleUpdaterService.bindOnUpdate(() => {});
});

test("no article open — nothing is fetched", async () => {
	await ArticleUpdaterService.update(apiUrlCreatorWith(""));

	expect(fetchMock).not.toHaveBeenCalled();
});

test("an article is open — the page data is fetched and delivered", async () => {
	const data = { articleProps: { title: "Article" } };
	fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data }) });
	const onUpdate = jest.fn();
	ArticleUpdaterService.bindOnUpdate(onUpdate);

	await ArticleUpdaterService.update(apiUrlCreatorWith("catalog/article"));

	expect(fetchMock).toHaveBeenCalledTimes(1);
	expect(onUpdate).toHaveBeenCalledWith(data);
});
