import { expect } from "@playwright/test";
import { addRootArticleButton, articleActionsButton, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// A read-only catalog offers no way to create an article — neither the panel button nor the menu
// item. Same `conf.isReadOnly` flag the panel and the menu read.

catalogTest.use({
	startUrl: "/nav-add-ro/start",
	files: {
		"nav-add-ro": {
			"doc-root.yml": "title: Nav Add RO\n",
			"start.md": "---\ntitle: Start\n---\n\nstub",
		},
	},
	isReadOnly: true,
});

catalogTest("a read-only catalog offers no creation", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	// A count of zero is only evidence once the tree is on screen.
	await expect(navItem(sharedPage, "Start")).toBeVisible({ timeout: 60_000 });
	await expect(sharedPage.getByRole("dialog")).toHaveCount(0);
	await expect(addRootArticleButton(sharedPage)).toHaveCount(0);

	// Either the row has no actions menu at all, or its menu has no sub-article item.
	await navItem(sharedPage, "Start").hover();
	const actions = articleActionsButton(sharedPage, "Start");
	if (await actions.count()) {
		await actions.click();
		await expect(sharedPage.getByRole("menu")).toBeVisible();
	}
	await expect(sharedPage.getByRole("menuitem", { name: "Add a sub-article" })).toHaveCount(0);
});
