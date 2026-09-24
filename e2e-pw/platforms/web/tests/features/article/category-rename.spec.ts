import { expect } from "@playwright/test";
import { addRootArticleButton, addSubArticleButton, catalogNav, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// Renaming a section moves its whole folder. The tree is patched in place for that, so every
// descendant has to move with it — a child left on the old folder leads nowhere.

catalogTest.use({
	startUrl: "/section-rename/start",
	files: {
		"section-rename": {
			"doc-root.yml": "title: Section\n",
			"start.md": "---\ntitle: Start\n---\n\nstub",
		},
	},
});

catalogTest("a child of a renamed section still opens from the tree", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await addRootArticleButton(sharedPage).click();
	await basePage.waitForLoad();
	const parentUrl = sharedPage.url();

	await navItem(sharedPage, "Untitled").hover();
	await addSubArticleButton(sharedPage, "Untitled").click();
	await expect(async () => expect(sharedPage.url()).toContain("/untitled/untitled")).toPass({ timeout: 10_000 });
	await basePage.waitForLoad();
	await sharedPage.keyboard.type("Child");
	await sharedPage.keyboard.press("Enter");
	await expect(async () => expect(sharedPage.url()).toContain("/untitled/child")).toPass({ timeout: 10_000 });
	await basePage.waitForLoad();

	await basePage.navigate(new URL(parentUrl).pathname);
	await basePage.waitForLoad();
	// The title is the editor's first block; the placeholder article has none yet.
	await sharedPage.locator('[data-testid="article-editor"] .ProseMirror > *').first().click();
	await sharedPage.keyboard.type("Alpha");
	await sharedPage.keyboard.press("Enter");
	await expect(async () => expect(sharedPage.url()).toContain("/alpha")).toPass({ timeout: 10_000 });
	await basePage.waitForLoad();

	await navItem(sharedPage, "Child").click();
	await expect(async () => expect(sharedPage.url()).toContain("/alpha/child")).toPass({ timeout: 10_000 });
	await basePage.waitForLoad();
	await expect(sharedPage.getByTestId("article-editor")).toContainText("Child");
	await expect(catalogNav(sharedPage)).toBeVisible();
});
