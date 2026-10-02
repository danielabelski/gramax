import { expect, type Page } from "@playwright/test";
import { addRootArticleButton, catalogNav, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// Creating an article must not depend on a pointer: the tree ends with a standing "Add article"
// row, and every row carries a sub-article button. Both are what a keyboard, a screen reader and an
// agent reading the accessibility tree find without hovering anything.

catalogTest.use({
	startUrl: "/nav-add/start",
	files: {
		"nav-add": {
			"doc-root.yml": "title: Nav Add\n",
			"start.md": "---\ntitle: Start\n---\n\nstub",
		},
	},
});

const focusedName = (page: Page) =>
	page.evaluate(() => {
		const active = document.activeElement;
		return active?.getAttribute("aria-label") ?? active?.textContent?.trim() ?? "";
	});

/** Presses Tab until the focused element carries `name`; the keyboard route is the point, not `focus()`. */
const tabUntil = async (page: Page, name: string, limit = 40) => {
	for (let i = 0; i < limit; i++) {
		await page.keyboard.press("Tab");
		if ((await focusedName(page)) === name) return;
	}
	throw new Error(`Tab never reached "${name}" within ${limit} presses`);
};

const caretInTitle = (page: Page) =>
	page.evaluate(() => {
		const editor = document.querySelector('[data-testid="article-editor"]');
		const first = editor?.querySelector(".ProseMirror > *");
		const anchor = window.getSelection()?.anchorNode;
		return {
			inEditor: !!editor && editor.contains(document.activeElement),
			inTitle: !!first && !!anchor && first.contains(anchor),
		};
	});

catalogTest(
	"the root button is on screen without hover, and the keyboard creates a root article",
	async ({ basePage, sharedPage }) => {
		await basePage.waitForLoad();

		// First thing the spec does — no pointer has moved yet.
		await expect(addRootArticleButton(sharedPage)).toBeVisible();

		await sharedPage.getByRole("link", { name: "Nav Add" }).focus();
		await tabUntil(sharedPage, "Add article");
		await sharedPage.keyboard.press("Enter");

		await expect(async () => expect(sharedPage.url()).toContain("/untitled")).toPass({ timeout: 10_000 });
		await basePage.waitForLoad();
		await expect(async () =>
			expect(await caretInTitle(sharedPage)).toEqual({ inEditor: true, inTitle: true }),
		).toPass({
			timeout: 5_000,
		});

		// The new article is the last root row.
		const rows = catalogNav(sharedPage).getByRole("button", { name: /^(Start|Untitled)$/ });
		await expect(rows.last()).toHaveAccessibleName("Untitled");
	},
);

catalogTest("the row offers a sub-article button, reachable by keyboard", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await navItem(sharedPage, "Start").focus();
	await tabUntil(sharedPage, "Add a sub-article");
	await sharedPage.keyboard.press("Enter");

	await expect(async () => expect(sharedPage.url()).toContain("/start/untitled")).toPass({ timeout: 10_000 });
	await expect(navItem(sharedPage, "Untitled")).toBeVisible();
});
