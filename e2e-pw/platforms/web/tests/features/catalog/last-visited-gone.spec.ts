import { expect } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// The catalog card leads to the article its reader was last on. When that article is gone — deleted
// by a colleague and pulled in, moved on disk — the card opens the catalog instead of a 404.

catalogTest.use({
	startUrl: "/card-gone/gone",
	files: {
		"card-gone": {
			"doc-root.yml": "title: Card Gone\n",
			"keep.md": "---\ntitle: Keep\norder: 1\n---\n\nkeep body",
			"gone.md": "---\ntitle: Gone\norder: 2\n---\n\ngone body",
		},
	},
});

catalogTest(
	"the catalog card opens the catalog once its remembered article is gone",
	async ({ basePage, catalogPage, sharedPage }) => {
		await expect(sharedPage.getByText("gone body")).toBeVisible();

		await catalogPage.evaluateOnApp(async () => {
			const { wm } = await window.app!;
			await wm.current().getFileProvider().delete(window.debug.intoPath("card-gone/gone.md"));
			await (await wm.current().getContextlessCatalog("card-gone")).update();
		});

		await basePage.navigate("/");
		await expect(sharedPage.getByRole("link", { name: "Card Gone" })).toHaveAttribute("href", /\/card-gone\/gone$/);
		await sharedPage.getByRole("button", { name: "Card Gone" }).click();

		await expect(sharedPage.getByText("keep body")).toBeVisible();
	},
);
