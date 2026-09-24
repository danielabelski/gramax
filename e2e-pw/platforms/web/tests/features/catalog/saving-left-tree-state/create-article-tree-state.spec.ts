import { expect } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

catalogTest.use({
	startUrl: "/test-catalog",
	dir: new URL(".", import.meta.url),
	isolated: true,
});

catalogTest.describe("creating a child article preserves parent tree state", () => {
	catalogTest.beforeEach(async ({ sharedPage, catalogPage }) => {
		await sharedPage.evaluate(() => localStorage.removeItem("nav-tree-state"));
		await sharedPage.reload();
		await catalogPage.waitForLoad();
	});

	catalogTest("parent category stays expanded after adding a child article", async ({ catalogPage }) => {
		const leafArticle = catalogPage.navItem("Leaf Article");

		await catalogPage.navItemChevron("Child Category").click();
		await expect(leafArticle).toBeVisible();

		await catalogPage.createChildArticle("Child Category");

		await expect(leafArticle).toBeVisible();
	});

	catalogTest(
		"newly created child article becomes active and selected in the nav tree",
		async ({ sharedPage, catalogPage }) => {
			await catalogPage.navItemChevron("Child Category").click();

			await catalogPage.createChildArticle("Child Category");

			await expect(sharedPage).toHaveURL(/untitled/);
			// Active nav items are not wrapped in a link; verify the new item is present but not a link
			await expect(sharedPage.getByText("Untitled", { exact: true })).toBeVisible();
			await expect(sharedPage.getByRole("link", { name: "Untitled", exact: true })).not.toBeAttached();
		},
	);

	catalogTest("a child article is created under a leaf article", async ({ sharedPage, catalogPage }) => {
		await catalogPage.navItemChevron("Child Category").click();

		await catalogPage.createChildArticle("Leaf Article");

		// The leaf article is turned into a category and the new article lands inside it.
		await expect(sharedPage).toHaveURL(/\/parent-category\/child-category\/leaf-article\/untitled$/);
		expect((await catalogPage.currentArticleContent()).md.trim()).toBe("");
	});

	catalogTest("a child article is created inside the freshly created one", async ({ sharedPage, catalogPage }) => {
		await catalogPage.navItemChevron("Child Category").click();

		await catalogPage.createChildArticle("Leaf Article");
		await catalogPage.createChildArticle("Untitled");

		await expect(sharedPage).toHaveURL(/\/child-category\/leaf-article\/untitled\/untitled$/);
		expect((await catalogPage.currentArticleContent()).md.trim()).toBe("");
	});

	catalogTest(
		"a branch opened by navigation closes after creating a sibling article higher up",
		async ({ sharedPage, catalogPage }) => {
			const leafInNav = catalogPage.navItem("Leaf Article");

			await sharedPage.goto("/-/-/-/-/test-catalog/parent-category/child-category/leaf-article");
			await catalogPage.waitForLoad();
			await expect(leafInNav).toBeVisible();

			await catalogPage.createChildArticle("Parent Category");

			await expect(leafInNav).not.toBeVisible();
		},
	);
});
