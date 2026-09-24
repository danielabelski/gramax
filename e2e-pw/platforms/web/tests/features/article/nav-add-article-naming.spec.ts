import { expect } from "@playwright/test";
import { addRootArticleButton, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// An article may be titled exactly like the tree's own control. Role and name alone would then
// point at two buttons; the row lives in a list item and the control does not.

catalogTest.use({
	startUrl: "/nav-add-naming/start",
	files: {
		"nav-add-naming": {
			"doc-root.yml": "title: Nav Add Naming\n",
			"start.md": "---\ntitle: Start\n---\n\nstub",
			"same-name.md": "---\ntitle: Add article\n---\n\nstub",
		},
	},
});

catalogTest("an article titled like the control is still told apart from it", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await expect(navItem(sharedPage, "Add article")).toHaveCount(1);
	await expect(addRootArticleButton(sharedPage)).toHaveCount(1);

	await addRootArticleButton(sharedPage).click();
	await expect(async () => expect(sharedPage.url()).toContain("/untitled")).toPass({ timeout: 10_000 });
});
