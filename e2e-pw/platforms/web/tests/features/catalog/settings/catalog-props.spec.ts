import { expect } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// Catalog settings: the plain props on the "General" and "Repository" tabs.
// Custom catalog *properties* (flags/enums) are a different feature — see ../properties/catalog-manage.spec.ts.

catalogTest.use({
	startUrl: "/test-catalog",
	dir: new URL(".", import.meta.url),
	isolated: true,
});

catalogTest.describe("Catalog properties", () => {
	catalogTest("title and description are saved", async ({ catalogPage }) => {
		await catalogPage.waitForLoad();

		await catalogPage.openCatalogSettings();
		await catalogPage.modal.getByRole("textbox", { name: "Catalog Title" }).fill("Тест");
		await catalogPage.modal.getByRole("textbox", { name: "Description" }).fill("123");
		await catalogPage.saveSettings();

		const props = await catalogPage.catalog("test-catalog").props();
		expect(props).toMatchObject({ title: "Тест", description: "123" });
	});

	catalogTest("repository url renames the catalog and docroot is saved", async ({ catalogPage, sharedPage }) => {
		await catalogPage.waitForLoad();

		const url = () => catalogPage.modal.getByRole("textbox", { name: "Name", exact: true });
		const docroot = () => catalogPage.modal.getByRole("textbox", { name: "Subdirectory" });

		await catalogPage.openCatalogSettings("Repository");
		await url().fill("renamed-catalog");
		await docroot().fill("docs/inner");
		await catalogPage.saveSettings();

		// The url is the catalog's system name, so saving it moves the reader to the new address.
		await expect(sharedPage).toHaveURL(/\/renamed-catalog(\/|$)/);

		// The docroot is not a stored prop — it is where the catalog's root category sits on disk.
		expect(await catalogPage.catalog("renamed-catalog").rootCategoryPath()).toBe("renamed-catalog/docs/inner");

		// The move keeps the logical paths, so every article is still reachable at its old address.
		await catalogPage.goto("/renamed-catalog/parent-category/child-category/leaf-article");
		await catalogPage.waitForLoad();
		expect((await catalogPage.currentArticleProps()).title).toBe("Leaf Article");
		expect((await catalogPage.currentArticleContent()).md).toContain("Leaf article content.");

		// Both values come back from the form once the catalog has been re-read.
		await sharedPage.reload();
		await catalogPage.waitForLoad();
		await catalogPage.openCatalogSettings("Repository");
		await expect(url()).toHaveValue("renamed-catalog");
		await expect(docroot()).toHaveValue("docs/inner");
	});
});
