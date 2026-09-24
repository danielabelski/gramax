import { expect } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// Article settings: renaming an article through its props form.
// The *automatic* title (typing a heading renames a placeholder article) is covered by
// ./title-rename-check.spec.ts and ../../editor/heading.spec.ts — not repeated here.

catalogTest.use({
	startUrl: "/props-catalog/root-article",
	files: {
		"props-catalog": {
			"doc-root.yml": "title: Props Catalog\n",
			"root-article.md": "---\ntitle: Root Article\n---\n\nbody",
		},
	},
});

catalogTest("article title and url are saved", async ({ catalogPage, sharedPage }) => {
	await catalogPage.waitForLoad();

	await catalogPage.openArticleProps("Root Article");
	await catalogPage.modal.getByRole("textbox", { name: "Title", exact: true }).fill("Тест");
	await catalogPage.modal.getByRole("textbox", { name: "Article-url" }).fill("test1");
	await catalogPage.modal.getByRole("button", { name: "Save" }).click();
	await expect(catalogPage.modal).toBeHidden();
	await catalogPage.waitForLoad();

	// The renamed article is the current one, so the reader is moved to its new address.
	await expect(sharedPage).toHaveURL(/\/props-catalog\/test1$/);
	await expect(catalogPage.navItem("Тест")).toBeVisible();

	const props = await catalogPage.currentArticleProps();
	expect(props).toMatchObject({ title: "Тест" });

	// The new url is the only one that resolves now.
	await catalogPage.goto("/props-catalog/test1");
	await catalogPage.waitForLoad();
	expect((await catalogPage.currentArticleProps()).title).toBe("Тест");
	expect((await catalogPage.currentArticleContent()).md).toContain("body");
});
