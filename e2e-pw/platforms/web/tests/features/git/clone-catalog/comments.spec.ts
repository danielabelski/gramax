import { expect, type Locator, type Page } from "@playwright/test";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { homeTest as test } from "@web/fixtures/home.fixture";
import CatalogPage from "@web/pom/catalog.page";
import { ClonePom } from "@web/pom/clone.pom";
import { ArticleEditorPom } from "@web/pom/editor.pom";

const source = getSourceDataFromEnv();
const repo = getTestRepoInfoFromEnv();

const CATALOG = repo.testRepo;
// Cloned catalogs use the long git URL form: /<host>/<group>/<repo>/<branch>/-/<article>.
// The group is one path segment, so its own slashes have to be escaped.
const CATALOG_BASE = `/${repo.host}/${encodeURIComponent(repo.group)}/${CATALOG}/master/-`;
const COMMENT_ARTICLE = `${CATALOG_BASE}/comments/local`;
const COMMENT_BODY = "Комментарий тест.";
/** The commented sentence the fixture ships in `comments/local`. */
const ARTICLE_TEXT = "Текст статьи.";
/** The line the "add a comment" scenario writes and then comments on. */
const SELECTION_TEXT = "Текст для комментария";
/** Title of the fixture section the new-comment scenario adds its article under. */
const SECTION_TITLE = "Marks";
const CATALOG_TITLE = "Автотест";

/** Commented text carries the comment as an inline mark; clicking it opens the popover. */
const commentedText = (page: Page, text: string): Locator => page.getByText(text, { exact: true }).first();

/** The comment popover, a dialog anchored to the commented node. */
const commentPopover = (page: Page): Locator => page.getByRole("dialog", { name: "Comment" }).first();

const commentEditorInput = (page: Page): Locator => page.getByRole("textbox", { name: "Leave a comment" }).first();

const inlineToolbarCommentButton = (page: Page): Locator => page.getByTestId("tb-comment");

/**
 * Opens an article and waits until the editor is on screen.
 *
 * The wait is not cosmetic: until the app finishes booting, `window.refreshPage` is still the
 * default one, which hard-reloads the tab a tick after it is called — and `setMarkdown` calls it.
 * A visible editor means boot is done and the app's own soft refresh is installed.
 */
const openArticle = async (sharedPage: Page, baseURL: string, path: string) => {
	const catalogPage = new CatalogPage(sharedPage, baseURL);
	const editor = new ArticleEditorPom(catalogPage);

	await catalogPage.goto(path);
	await catalogPage.waitForLoad();
	await expect(editor.body).toBeVisible();

	return { catalogPage, editor };
};

test.describe
	.serial("Comments", () => {
		test("clone test-catalog", async ({ homePage, sharedPage }) => {
			test.slow();

			const clone = new ClonePom(homePage);
			await clone.cloneWithNewStorage(source, { group: repo.group, repo: repo.testRepo });
			await clone.openCatalog(CATALOG_TITLE);

			await sharedPage.getByRole("link", { name: CATALOG_TITLE }).click();
			await homePage.waitForLoad();
		});

		test("opens the comment popover", async ({ sharedPage, baseURL }) => {
			await openArticle(sharedPage, baseURL!, COMMENT_ARTICLE);

			await commentedText(sharedPage, ARTICLE_TEXT).click();

			await expect(commentPopover(sharedPage)).toBeVisible();
			await expect(commentPopover(sharedPage).getByText(COMMENT_BODY)).toBeVisible();

			await sharedPage.keyboard.press("Escape");
			await expect(commentEditorInput(sharedPage)).toBeHidden();
		});

		test("copies a comment within the current article", async ({ sharedPage, baseURL }) => {
			const { editor } = await openArticle(sharedPage, baseURL!, COMMENT_ARTICLE);
			await editor.setMarkdown(`[comment:1]${ARTICLE_TEXT}[/comment](*)`);
			await editor.focus();

			await editor.press("ControlOrMeta+A ControlOrMeta+C");
			await editor.press("ArrowDown Enter ControlOrMeta+V");

			await editor.assertMarkdownContains(
				/\[comment:1\]Текст статьи\.\[\/comment\]\s+\[comment:[^\]]+\]Текст статьи\.\[\/comment\]/,
			);
		});

		test("copies a comment into another article", async ({ sharedPage, baseURL }) => {
			// Seed a commented paragraph and copy it in the source article.
			const source = await openArticle(sharedPage, baseURL!, COMMENT_ARTICLE);
			await source.editor.setMarkdown(`[comment:1]${ARTICLE_TEXT}[/comment](*)`);
			await source.editor.focus();
			await source.editor.press("ControlOrMeta+A ControlOrMeta+C");

			// Move to a different, cleared article and paste.
			const { catalogPage, editor } = await openArticle(sharedPage, baseURL!, `${CATALOG_BASE}/comments/server`);
			await editor.setMarkdown("(*)");
			await editor.focus();
			await editor.press("ControlOrMeta+V");

			// Pasted into another article: comment is restored under a new id, text preserved.
			await editor.assertMarkdownContains(/\[comment:[^\]]+\]Текст статьи\.\[\/comment\]/);

			await commentedText(catalogPage.raw, ARTICLE_TEXT).click();
			await expect(commentPopover(sharedPage).getByText(COMMENT_BODY)).toBeVisible();
		});

		test("adds a comment to a text selection", async ({ basePage, sharedPage, baseURL }) => {
			const { catalogPage, editor } = await openArticle(
				sharedPage,
				baseURL!,
				`${CATALOG_BASE}/content/new_article_5`,
			);

			const urlBeforeCreate = sharedPage.url();

			// The row's "+" only fades in while the row is hovered, so go through the nav item.
			await catalogPage.createChildArticle(SECTION_TITLE);
			await sharedPage.waitForURL((url) => url.toString() !== urlBeforeCreate, { timeout: 15_000 });
			await basePage.waitForLoad();
			await editor.setMarkdown(`${SELECTION_TEXT}(*)`);
			await editor.focus();
			await editor.press("ControlOrMeta+A");
			await inlineToolbarCommentButton(sharedPage).click();

			await commentEditorInput(sharedPage).click();
			await sharedPage.keyboard.type("комментарий");
			// The input closes once the comment is committed; reading it back before that races the save.
			await sharedPage.keyboard.press("ControlOrMeta+Enter");
			await expect(commentEditorInput(sharedPage)).toBeHidden();

			await editor.press("Home");
			await commentedText(sharedPage, SELECTION_TEXT).click();
			await expect(commentPopover(sharedPage).getByText("комментарий")).toBeVisible();
		});

		test("adds a comment to a diagram block", async ({ basePage, sharedPage, baseURL }) => {
			const { editor } = await openArticle(sharedPage, baseURL!, `${CATALOG_BASE}/content/block-nodes`);
			await editor.setMarkdown("(*)");
			await editor.focus();

			await editor.clickToolbar("semiBlocks");
			await sharedPage.getByRole("menuitemradio", { name: "Mermaid" }).click();
			await basePage.waitForLoad();

			const block = sharedPage.getByRole("figure", { name: "Diagram" }).first();
			await block.hover();
			const nodeActions = sharedPage.getByRole("toolbar", { name: "Actions" });
			await nodeActions.hover();
			await nodeActions.getByRole("button", { name: "Leave a comment" }).click();

			await commentEditorInput(sharedPage).click();
			await sharedPage.keyboard.type("комментарий");
			// The input closes once the comment is committed; reading it back before that races the save.
			await sharedPage.keyboard.press("ControlOrMeta+Enter");
			await expect(commentEditorInput(sharedPage)).toBeHidden();

			// Saving leaves the comment on screen, and "Show comment" is a toggle: reopening it while it
			// is already up just closes it again.
			await sharedPage.keyboard.press("Escape");
			await expect(commentPopover(sharedPage)).toBeHidden();
			const reviewPanel = sharedPage.locator('[data-floating-panel-id="review"]');
			if (await reviewPanel.isVisible()) await reviewPanel.getByTestId("floating-panel-close").click();

			await block.hover();
			const newNodeActions = sharedPage.getByRole("toolbar", { name: "Actions" });
			await newNodeActions.hover();
			await newNodeActions.getByRole("button", { name: "Show comment" }).click();
			await expect(commentPopover(sharedPage).getByText("комментарий")).toBeVisible();
		});
	});
