import type { PageProps } from "@components/Pages/models/Pages";
import { act, renderHook } from "@testing-library/react";
import { fetchPageData, usePortalPageData } from "./usePortalPageData";

const page = (title: string) =>
	({ page: "article", data: { articleProps: { title }, catalogProps: { title: "Docs" } } }) as unknown as PageProps;

/** Answers each page request only when the test says so, in whatever order it says. */
const holdPageRequests = () => {
	const answers = new Map<string, (data: PageProps) => void>();
	global.fetch = jest.fn(
		(url: string) =>
			new Promise((resolve) => {
				const path = new URL(url, "http://portal").searchParams.get("path");
				answers.set(path, (data) => resolve({ ok: true, json: async () => data }));
			}),
	) as never;
	return (path: string, data: PageProps) => act(async () => answers.get(path)(data));
};

describe("docportal page data", () => {
	test("sends the content language from the target path", async () => {
		const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
		global.fetch = fetchMock as never;

		await fetchPageData("/docs/en/whats-new");

		expect(fetchMock).toHaveBeenCalledWith("/api/page/getPageData?path=%2Fdocs%2Fen%2Fwhats-new&mode=read", {
			headers: { "x-gramax-language": "en" },
		});
	});

	test("a page the reader already left does not replace the next one when it arrives late", async () => {
		const answer = holdPageRequests();
		const { result, rerender } = renderHook(({ path }) => usePortalPageData(path, page("Start")), {
			initialProps: { path: "/docs/start" },
		});

		rerender({ path: "/docs/heavy" });
		rerender({ path: "/docs/light" });
		await answer("/docs/light", page("Light"));
		await answer("/docs/heavy", page("Heavy"));

		expect(result.current.pageData).toEqual(page("Light"));
	});
});
