import { expect } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

const fragment = "kumquat marmalade recipe";

catalogTest.use({
	startUrl: "/search-catalog/alpha",
	files: {
		"search-catalog": {
			"doc-root.yml": "title: Search Catalog\n",
			"alpha.md": "---\ntitle: Alpha\norder: 1\n---\n\nAlpha body text.",
			"beta.md": `---\ntitle: Newest article\norder: 2\n---\n\n${fragment} lives in this paragraph.`,
		},
	},
});

catalogTest.describe("Catalog search", () => {
	catalogTest("a title match navigates to the article", async ({ catalogPage, sharedPage }) => {
		await catalogPage.waitForLoad();

		const search = catalogPage.search();
		await search.open();
		await search.query("Newest");
		await search.openResult(search.articleResult("Newest article"));

		await expect(sharedPage).toHaveURL(/\/search-catalog\/beta$/);
		expect((await catalogPage.currentArticleProps()).title).toBe("Newest article");
	});

	catalogTest("a fragment match carries highlightFragment in the url", async ({ catalogPage, sharedPage }) => {
		await catalogPage.waitForLoad();

		const search = catalogPage.search();
		await search.open();
		await search.query("kumquat");
		await search.openResult(search.fragmentResult("kumquat"));

		await expect(sharedPage).toHaveURL(/\/search-catalog\/beta\?/);

		const url = new URL(sharedPage.url());
		expect(url.searchParams.get("highlightFragment")).toContain("kumquat");
		expect(url.searchParams.get("highlightFragmentIndex")).toBe("0");
	});
});
