import { expect } from "@playwright/test";
import { addRootArticleButton, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// Placeholder article (untitled/new_article_*) must still be renamed to the title slug
// after the user actually types a title and leaves the title line.

catalogTest.use({
	startUrl: "/rename-check/start",
	files: {
		"rename-check": {
			"doc-root.yml": "title: Rename Check\n",
			"start.md": "---\ntitle: Start\n---\n\nstub",
		},
	},
});

catalogTest("typing a title renames a placeholder article", async ({ basePage, catalogPage, sharedPage }) => {
	await basePage.waitForLoad();

	await catalogPage.createChildArticle("Start");
	await basePage.waitForLoad();
	expect(sharedPage.url()).toContain("untitled");

	await sharedPage.keyboard.type("My Fancy Title");
	await sharedPage.keyboard.press("Enter");
	await sharedPage.keyboard.type("body text");

	await expect(async () => {
		expect(sharedPage.url()).toContain("my-fancy-title");
	}).toPass({ timeout: 10_000 });
});

catalogTest("the editor keeps focus once the rename updates the url", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await addRootArticleButton(sharedPage).click();
	await basePage.waitForLoad();

	// Holds the editor node itself, not just the fact of focus: replacing the address and rebuilding
	// the view are separate events, and between them the test can still see the old editor alive. A
	// rebuilt view gives a different node — visible even if focus is back where it belongs by then.
	const editorBefore = await sharedPage.evaluateHandle(() =>
		document.querySelector('[data-testid="article-editor"]'),
	);

	await sharedPage.keyboard.type("My Fancy Title");
	await sharedPage.keyboard.press("Enter");

	// The url changes synchronously while the page data lands later, and the tab title does not catch
	// that: it is set in the same stack as `setData`, before React commits. The barrier is the rendered
	// tree item with the new title — it exists only after the commit, and in the broken version that
	// same commit rebuilds the view.
	await expect(async () => {
		expect(sharedPage.url()).toContain("my-fancy-title");
	}).toPass({ timeout: 10_000 });
	await expect(
		sharedPage.locator('[data-qa^="catalog-navigation-article-link"]', { hasText: "My Fancy Title" }).first(),
	).toBeVisible();
	await basePage.waitForLoad();

	const state = await sharedPage.evaluate(
		(kept) => ({
			sameNode: kept === document.querySelector('[data-testid="article-editor"]'),
			focused: !!document.activeElement?.closest('[data-testid="article-editor"]'),
		}),
		editorBefore,
	);
	expect(state, "the same editor stays on screen and keeps the caret after the url is replaced").toEqual({
		sameNode: true,
		focused: true,
	});

	await sharedPage.keyboard.type("body text");
	await expect(sharedPage.getByTestId("article-editor")).toContainText("body text");
});

// A new article's placeholder is always `untitled.md`: once the first is renamed the path is free and
// the next takes it back. A view identified by path would call them one and keep the first article's
// editor on the second.
catalogTest(
	"a new article does not inherit the editor of the one renamed before it",
	async ({ basePage, sharedPage }) => {
		await basePage.waitForLoad();

		await addRootArticleButton(sharedPage).click();
		await basePage.waitForLoad();

		await sharedPage.keyboard.type("Alpha Title");
		await sharedPage.keyboard.press("Enter");
		await sharedPage.keyboard.type("alpha body");

		await expect(async () => {
			expect(sharedPage.url()).toContain("alpha-title");
		}).toPass({ timeout: 10_000 });
		await basePage.waitForLoad();

		await addRootArticleButton(sharedPage).click();
		await basePage.waitForLoad();

		expect(sharedPage.url()).toContain("untitled");
		const editor = sharedPage.getByTestId("article-editor");
		await expect(editor).not.toContainText("Alpha Title");
		await expect(editor).not.toContainText("alpha body");
	},
);

// The client only guesses the file name. When the guess is taken the server picks a free one and
// returns it — the url, the tree and the next write all have to follow the actual name.
catalogTest(
	"a title whose file name is taken moves the article to the free one",
	async ({ basePage, sharedPage, catalogPage }) => {
		await basePage.waitForLoad();

		await addRootArticleButton(sharedPage).click();
		await basePage.waitForLoad();

		// `start.md` is already in the catalog — "Start" runs into a taken name
		await sharedPage.keyboard.type("Start");
		await sharedPage.keyboard.press("Enter");
		await sharedPage.keyboard.type("second start");

		await expect(async () => {
			expect(sharedPage.url()).toContain("start-2");
			expect((await catalogPage.currentArticleContent()).md).toContain("second start");
		}).toPass({ timeout: 10_000 });

		// the original article is intact — neither overwritten nor renamed
		await basePage.waitForLoad();
		await sharedPage.goto(`${new URL(sharedPage.url()).origin}/-/-/-/-/rename-check/start`);
		await basePage.waitForLoad();
		await expect(sharedPage.getByTestId("article-editor")).toContainText("stub");
	},
);

catalogTest("the document title follows the renamed article", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await addRootArticleButton(sharedPage).click();
	await basePage.waitForLoad();

	await sharedPage.keyboard.type("My Fancy Title");
	await sharedPage.keyboard.press("Enter");

	await expect(async () => {
		expect(sharedPage.url()).toContain("my-fancy-title");
		expect(await sharedPage.title()).toContain("My Fancy Title");
	}).toPass({ timeout: 10_000 });
});

catalogTest(
	"text typed while the article is renamed reaches its new file",
	async ({ basePage, sharedPage, catalogPage }) => {
		await basePage.waitForLoad();

		await addRootArticleButton(sharedPage).click();
		await basePage.waitForLoad();

		await sharedPage.keyboard.type("My Fancy Title");
		await sharedPage.keyboard.press("Enter");
		await sharedPage.keyboard.type("body text");

		await expect(async () => {
			expect(sharedPage.url()).toContain("my-fancy-title");
			expect((await catalogPage.currentArticleContent()).md).toContain("body text");
		}).toPass({ timeout: 10_000 });
	},
);

// The backend resolves the article by the file path in props. While the page was re-read that path
// arrived fresh on its own; now only the rename response updates it — and if it falls behind, every
// later edit goes nowhere, silently.
catalogTest("a second title edit after the rename still saves", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await addRootArticleButton(sharedPage).click();
	await basePage.waitForLoad();

	await sharedPage.keyboard.type("First Title");
	await sharedPage.keyboard.press("Enter");
	await sharedPage.keyboard.type("body text");

	await expect(async () => {
		expect(sharedPage.url()).toContain("first-title");
	}).toPass({ timeout: 10_000 });

	const editor = sharedPage.getByTestId("article-editor");
	await editor.getByText("First Title").first().click();
	await sharedPage.keyboard.press("Home");
	await sharedPage.keyboard.press("Shift+End");
	await sharedPage.keyboard.type("Second Title");
	await sharedPage.keyboard.press("ArrowDown");

	// The title edit is debounced: reloading before it fires would test a race, not the save.
	await basePage.waitForLoad();
	await sharedPage.reload();
	await basePage.waitForLoad();

	await expect(sharedPage.getByTestId("article-editor")).toContainText("Second Title");
});

// A title whose slug matches the file name renames nothing on disk. The tree is still patched in
// place, and the title it shows has to follow.
catalogTest("a title that keeps the file name still retitles the tree", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await addRootArticleButton(sharedPage).click();
	await basePage.waitForLoad();

	await sharedPage.keyboard.type("UNTITLED");
	await sharedPage.keyboard.press("Enter");

	await expect(navItem(sharedPage, "UNTITLED")).toBeVisible({ timeout: 10_000 });
	expect(sharedPage.url()).toContain("untitled");
});

// The left tree lives off the page data, and the page is not re-read after a rename: the item is
// updated by a targeted patch, and without it keeps the old title.
catalogTest("the left tree shows the renamed article", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await addRootArticleButton(sharedPage).click();
	await basePage.waitForLoad();

	await sharedPage.keyboard.type("My Fancy Title");
	await sharedPage.keyboard.press("Enter");

	await expect(async () => {
		expect(sharedPage.url()).toContain("my-fancy-title");
	}).toPass({ timeout: 10_000 });

	const treeItem = sharedPage.locator('[data-qa^="catalog-navigation-article-link"]', {
		hasText: "My Fancy Title",
	});
	await expect(treeItem.first()).toBeVisible();
});
