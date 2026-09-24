import { expect } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

catalogTest.use({
	startUrl: "/delete-catalog",
	files: {
		"delete-catalog": {
			"doc-root.yml": "title: Delete Catalog\n",
			"_index.md": "---\ntitle: Root Article\n---\n\nroot",
			"lonely.md": "---\ntitle: Lonely\norder: 2\n---\n\nlonely",
			section: {
				"_index.md": "---\ntitle: Section\norder: 1\n---\n\nsection",
				"child.md": "---\ntitle: Child\n---\n\nchild",
			},
		},
	},
});

catalogTest.describe("Deleting items", () => {
	catalogTest("deleting a section removes it with everything nested in it", async ({ catalogPage }) => {
		await catalogPage.waitForLoad();

		await expect(catalogPage.navItem("Section")).toBeVisible();

		await catalogPage.deleteNavItem("Section");

		await expect(catalogPage.navItem("Section")).toHaveCount(0);
		await expect(catalogPage.navItem("Child")).toHaveCount(0);
		// The rest of the catalog survives.
		await expect(catalogPage.navItem("Lonely")).toBeVisible();
	});

	catalogTest("deleting an article removes just that article", async ({ catalogPage }) => {
		await catalogPage.waitForLoad();

		await expect(catalogPage.navItem("Lonely")).toBeVisible();

		await catalogPage.deleteNavItem("Lonely");

		await expect(catalogPage.navItem("Lonely")).toHaveCount(0);
		await expect(catalogPage.navItem("Section")).toBeVisible();
	});
});
