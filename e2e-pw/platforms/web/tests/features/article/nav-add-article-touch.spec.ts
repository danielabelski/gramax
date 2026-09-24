import { expect } from "@playwright/test";
import { addRootArticleButton, articleActionsButton, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// A tablet has no hover. Every creation route has to work by taps alone, in the desktop layout and
// in the mobile one, where the sidebar opens as an overlay.

catalogTest.use({
	startUrl: "/nav-add-touch/start",
	files: {
		"nav-add-touch": {
			"doc-root.yml": "title: Nav Add Touch\n",
			"start.md": "---\ntitle: Start\n---\n\nstub",
		},
	},
	sharedContextHasTouch: true,
});

catalogTest("a tap on the root button creates a root article", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await addRootArticleButton(sharedPage).tap();

	await expect(async () => expect(sharedPage.url()).toContain("/untitled")).toPass({ timeout: 10_000 });
});

catalogTest("taps alone reach the sub-article item in the row menu", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await navItem(sharedPage, "Start").tap();
	await basePage.waitForLoad();
	await articleActionsButton(sharedPage, "Start").tap();
	await sharedPage.getByRole("menuitem", { name: "Add a sub-article" }).tap();

	await expect(async () => expect(sharedPage.url()).toContain("/start/untitled")).toPass({ timeout: 10_000 });
});

catalogTest("the mobile sidebar carries the root button too", async ({ basePage, sharedPage }) => {
	await sharedPage.setViewportSize({ width: 375, height: 812 });
	await basePage.waitForLoad();

	await sharedPage.getByRole("button", { name: "Expand sidebar" }).tap();
	await addRootArticleButton(sharedPage).tap();

	await expect(async () => expect(sharedPage.url()).toContain("/untitled")).toPass({ timeout: 10_000 });
	// Landing in the new article is the end of the route: the overlay is gone and the editor is on screen.
	await expect(sharedPage.getByRole("dialog", { name: "Sidebar" })).toBeHidden();
	await expect(sharedPage.getByTestId("article-editor")).toBeVisible();
});
