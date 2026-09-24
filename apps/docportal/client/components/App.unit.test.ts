/** @jest-environment node */
import { fetchPageData } from "./App";

describe("docportal page data", () => {
	test("sends the content language from the target path", async () => {
		const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
		global.fetch = fetchMock as never;

		await fetchPageData("/docs/en/whats-new");

		expect(fetchMock).toHaveBeenCalledWith("/api/page/getPageData?path=%2Fdocs%2Fen%2Fwhats-new&mode=read", {
			headers: { "x-gramax-language": "en" },
		});
	});
});
