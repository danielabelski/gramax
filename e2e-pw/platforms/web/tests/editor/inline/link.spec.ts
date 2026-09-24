import { expect } from "@playwright/test";
import { md } from "@utils/utils";
import { editorTest } from "@web/fixtures/editor.fixture";

editorTest.describe("Link", () => {
	const linkExample = "https://www.lipsum.com";
	editorTest("delete link in article text properly dont move focus to link", async ({ editor }) => {
		await editor.type(linkExample);

		await editor.assertMarkdownContains(linkExample);

		await Promise.all(Array.from({ length: linkExample.length }, () => editor.press("Backspace")));

		await editor.assertMarkdown("");
	});

	editorTest("select word and apply link via inline toolbar", async ({ editor, catalogPage }) => {
		await editor.type("Hello");
		await editor.press("ControlOrMeta+Shift+ArrowLeft");

		const inlineToolbar = catalogPage.raw.locator('[role="article-inline-toolbar"]');
		await expect(inlineToolbar).toBeVisible();
		await inlineToolbar.locator('[data-qa="link-button"]').click();

		const linkInput = catalogPage.raw.getByPlaceholder("Enter link or search for articles");
		await expect(linkInput).toBeVisible();
		await linkInput.fill(linkExample);

		await catalogPage.raw.keyboard.press("ArrowDown");
		await catalogPage.raw.locator('[data-slot="command-item"][data-selected="true"]').click();

		await editor.press("Backspace");

		const linkToolbar = catalogPage.raw.locator('[role="link-toolbar"]');
		await expect(linkToolbar).toContainText(linkExample);
	});

	editorTest(
		"link syncs with text only when they match — extra char prevents sync until removed",
		async ({ editor, catalogPage }) => {
			const textWithExtra = `${linkExample}X`;

			await editor.type(textWithExtra);
			await editor.press("ControlOrMeta+Shift+ArrowLeft");

			const inlineToolbar = catalogPage.raw.locator('[role="article-inline-toolbar"]');
			await expect(inlineToolbar).toBeVisible();
			await inlineToolbar.locator('[data-qa="link-button"]').click();

			const linkInput = catalogPage.raw.getByPlaceholder("Enter link or search for articles");
			await expect(linkInput).toBeVisible();
			await linkInput.fill(linkExample);

			await catalogPage.raw.keyboard.press("ArrowDown");
			await catalogPage.raw.locator('[data-slot="command-item"][data-selected="true"]').click();

			await editor.press("Backspace");

			const linkToolbar = catalogPage.raw.locator('[role="link-toolbar"]');
			await expect(linkToolbar).toContainText(linkExample);

			await editor.press("Backspace");

			await expect(linkToolbar).toContainText(linkExample.slice(0, -1));
		},
	);

	editorTest("edit link text in article also changes link if they're the same", async ({ editor, catalogPage }) => {
		await editor.pasteText(linkExample);

		await editor.assertMarkdownContains(linkExample);

		const linkToolbar = catalogPage.raw.locator('[role="link-toolbar"]');
		await expect(linkToolbar).toBeVisible();
		await expect(linkToolbar).toHaveText(linkExample);

		await editor.press("Backspace");

		await expect(linkToolbar).toHaveText(linkExample.slice(0, -1));
	});

	editorTest("current article in link menu has selected state", async ({ editor, catalogPage }) => {
		await editor.type("Hello");
		await editor.press("ControlOrMeta+Shift+ArrowLeft");

		const inlineToolbar = catalogPage.raw.locator('[role="article-inline-toolbar"]');
		await expect(inlineToolbar).toBeVisible();
		await inlineToolbar.locator('[data-qa="link-button"]').click();

		await expect(catalogPage.raw.getByPlaceholder("Enter link or search for articles")).toBeVisible();

		await expect(
			catalogPage.raw.locator('[data-slot="command-item"][data-selected="true"]', {
				hasText: "Untitled",
			}),
		).toBeVisible();
	});
});

const HEADING_ARTICLE_TITLE = "Article With Headings";
const FIRST_HEADING = "First Heading";
const SECOND_HEADING = "Second Heading";

const headingLinkTest = editorTest.extend({
	files: {
		editor: {
			"untitled.md": "",
			"doc-root.yml": md`
				syntax: xml
			`,
			"with-headings.md": md`
				---
				title: ${HEADING_ARTICLE_TITLE}
				---

				# ${FIRST_HEADING}

				## ${SECOND_HEADING}
			`,
		},
	},
});

headingLinkTest.describe("Link headings submenu", () => {
	headingLinkTest("opening an article's headings submenu lists its headings", async ({ editor, catalogPage }) => {
		await editor.type("Hello");
		await editor.press("ControlOrMeta+Shift+ArrowLeft");

		const inlineToolbar = catalogPage.raw.locator('[role="article-inline-toolbar"]');
		await expect(inlineToolbar).toBeVisible();
		await inlineToolbar.locator('[data-qa="link-button"]').click();

		await expect(catalogPage.raw.getByPlaceholder("Enter link or search for articles")).toBeVisible();

		const articleRow = catalogPage.raw.locator('[data-slot="command-item"]', { hasText: HEADING_ARTICLE_TITLE });
		await expect(articleRow).toBeVisible();
		await articleRow.locator("button").click();

		const headingsMenu = catalogPage.raw.locator('[data-testid="dropdown-content"]');
		await expect(headingsMenu).toBeVisible();
		await expect(headingsMenu).toContainText(FIRST_HEADING);
		await expect(headingsMenu).toContainText(SECOND_HEADING);
		await expect(headingsMenu).not.toContainText("No links");
	});

	headingLinkTest(
		"picking a heading applies a link that points at that exact heading",
		async ({ editor, catalogPage }) => {
			await editor.type("Hello");
			await editor.press("ControlOrMeta+Shift+ArrowLeft");

			const inlineToolbar = catalogPage.raw.locator('[role="article-inline-toolbar"]');
			await expect(inlineToolbar).toBeVisible();
			await inlineToolbar.locator('[data-qa="link-button"]').click();

			await expect(catalogPage.raw.getByPlaceholder("Enter link or search for articles")).toBeVisible();

			const articleRow = catalogPage.raw.locator('[data-slot="command-item"]', {
				hasText: HEADING_ARTICLE_TITLE,
			});
			await expect(articleRow).toBeVisible();
			await articleRow.locator("button").click();

			const headingsMenu = catalogPage.raw.locator('[data-testid="dropdown-content"]');
			await expect(headingsMenu).toBeVisible();
			await headingsMenu.getByText(SECOND_HEADING, { exact: true }).click();

			// The href must carry the exact heading anchor (built from the heading text, see
			// getChildTextId), not just a bare link to the article.
			await editor.assertMarkdownContains(/\[Hello\]\([^)]*#second-heading\)/);
		},
	);

	headingLinkTest(
		"opening the applied heading link navigates to and scrolls to that heading",
		async ({ editor, catalogPage }) => {
			await editor.type("Hello");
			await editor.press("ControlOrMeta+Shift+ArrowLeft");

			const inlineToolbar = catalogPage.raw.locator('[role="article-inline-toolbar"]');
			await expect(inlineToolbar).toBeVisible();
			await inlineToolbar.locator('[data-qa="link-button"]').click();

			await expect(catalogPage.raw.getByPlaceholder("Enter link or search for articles")).toBeVisible();

			const articleRow = catalogPage.raw.locator('[data-slot="command-item"]', {
				hasText: HEADING_ARTICLE_TITLE,
			});
			await expect(articleRow).toBeVisible();
			await articleRow.locator("button").click();

			const headingsMenu = catalogPage.raw.locator('[data-testid="dropdown-content"]');
			await expect(headingsMenu).toBeVisible();
			await headingsMenu.getByText(SECOND_HEADING, { exact: true }).click();

			// Picking a heading closes the search popover and re-selects the mark; nudging the
			// selection (same trick the other link tests use) is what makes the view toolbar reappear.
			await editor.press("Backspace");

			const linkToolbar = catalogPage.raw.locator('[role="link-toolbar"]');
			await expect(linkToolbar).toBeVisible();
			await linkToolbar.getByText(HEADING_ARTICLE_TITLE, { exact: false }).click();

			// GoToArticle does a client-side navigation carrying the "#second-heading" anchor in the URL.
			await expect(catalogPage.raw).toHaveURL(/#second-heading/);

			// useScrollToArticleAnchor reads that anchor and scrollIntoView()s the matching heading
			// inside the [data-testid="article-scroll-container"] — this is what actually proves the
			// link doesn't just point at the article, but opens scrolled to the right heading.
			const scrollContainer = catalogPage.raw.locator('[data-testid="article-scroll-container"]');
			await expect(scrollContainer.locator("#second-heading")).toBeInViewport();
		},
	);
});
