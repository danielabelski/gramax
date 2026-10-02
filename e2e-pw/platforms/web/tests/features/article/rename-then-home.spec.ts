import { expect } from "@playwright/test";
import { navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";

// The catalog card on the home page opens the article its reader was last on. A rename by the title
// keeps the open page instead of re-reading it, and that re-read was what used to move the address.

catalogTest.use({
	startUrl: "/card-rename/start",
	files: {
		"card-rename": {
			"doc-root.yml": "title: Card Rename\n",
			"start.md": "---\ntitle: Start\n---\n\nstub",
		},
	},
});

catalogTest(
	"the catalog card opens the article renamed by its title",
	async ({ basePage, catalogPage, sharedPage }) => {
		const editor = new ArticleEditorPom(catalogPage);

		await catalogPage.createRootArticle();
		await sharedPage.keyboard.type("Setup");
		await editor.bottom().click();

		// The tree names the article only once the rename has answered.
		await expect(navItem(sharedPage, "Setup")).toBeVisible();
		await expect(sharedPage).toHaveURL(/\/setup$/);

		await basePage.navigate("/");
		await sharedPage.getByRole("button", { name: "Card Rename" }).click();

		await expect(sharedPage).toHaveURL(/\/card-rename\/setup$/);
		await expect(editor.body.getByText("Setup", { exact: true })).toBeVisible();
	},
);
