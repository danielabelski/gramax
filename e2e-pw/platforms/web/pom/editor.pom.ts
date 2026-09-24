import { expect, type Locator } from "@playwright/test";
import type BaseSharedPage from "@shared-pom/page";
import { sleep } from "@utils/utils";
import type CatalogPage from "./catalog.page";

type ToolbarButton =
	| "bold"
	| "italic"
	| "strikethrough"
	| "headers"
	| "lists"
	| "code"
	| "table"
	| "note"
	| "notes"
	| "semiBlocks";

export type AssertMdOpts = {
	ignoreTabs?: boolean;
	skipAssertMarkdownValid?: boolean;
};

export type SetMarkdownOpts = {
	skipAssertMarkdownValid?: boolean;
};

const toolbarIconMap: Record<ToolbarButton, string> = {
	bold: '[data-testid="tb-bold"]',
	italic: '[data-testid="tb-italic"]',
	strikethrough: '[data-testid="tb-strikethrough"]',
	headers: '[data-testid="tb-headers"]',
	lists: '[data-testid="tb-lists"]',
	code: '[data-testid="tb-code"]',
	table: '[data-testid="tb-table"]',
	note: '[data-testid="tb-note"]',
	notes: '[data-testid="tb-notes"]',
	semiBlocks: '[data-testid="tb-semi-blocks"]',
};

const CURSOR_MARKER = "GXCURSORPOSITIONMARKER";

class EditorPom<P extends BaseSharedPage = BaseSharedPage> {
	constructor(
		protected _page: P,
		private _testid: string,
	) {}

	async focus() {
		await this._page.raw.getByTestId(this._testid).focus();
	}
}

export class ArticleEditorPom extends EditorPom<CatalogPage> {
	constructor(page: CatalogPage) {
		super(page, "article-editor");
	}

	bottom() {
		return this._page.raw.getByTestId("article-bottom");
	}

	async markdown(): Promise<string> {
		const content = await this._page.currentArticleContent();
		return content.md;
	}

	async setMarkdown(markdown: string, opts?: SetMarkdownOpts) {
		const hasCursor = markdown.includes("(*)");
		const previousEditorDocument = hasCursor
			? await this._page.raw.evaluate(() => JSON.stringify(window.debug?.editor?.state.doc.toJSON()))
			: null;

		await this._page.evaluateOnApp(
			async ({ markdown, cursorMarker }) => {
				const app = await window.app!;
				const { catalogName, itemLogicPath } = window.debug.RouterPathProvider.parsePath(
					window.location.pathname,
				);
				const catalog = await app.wm.current().getContextlessCatalog(catalogName!);
				const article = catalog.findArticle(itemLogicPath!.join("/"), []);
				// Missing while the route is still settling — throwing hands it back to the retry.
				if (!article) throw new Error(`article not mounted yet: ${window.location.pathname}`);

				await article.updateContent(markdown.replaceAll("(*)", cursorMarker), true);

				await window.refreshPage();
			},
			{ markdown, cursorMarker: CURSOR_MARKER },
		);

		if (hasCursor) {
			await expect
				.poll(() => this._page.raw.evaluate(() => JSON.stringify(window.debug?.editor?.state.doc.toJSON())), {
					timeout: 30_000,
				})
				.not.toBe(previousEditorDocument);

			const cursorCoordinates = await this._page.raw.evaluate((cursorMarker) => {
				const editor = window.debug?.editor;
				if (!editor || editor.isDestroyed) return;

				let markerPosition: number | null = null;
				editor.state.doc.descendants((node, position) => {
					if (!node.isText || !node.text) return;
					const markerOffset = node.text.indexOf(cursorMarker);
					if (markerOffset !== -1) markerPosition = position + markerOffset;
				});
				if (markerPosition === null) return;

				editor.view.dispatch(editor.state.tr.delete(markerPosition, markerPosition + cursorMarker.length));
				editor.commands.setTextSelection(markerPosition);
				editor.view.focus();

				const coordinates = editor.view.coordsAtPos(markerPosition);
				return {
					x: (coordinates.left + coordinates.right) / 2,
					y: (coordinates.top + coordinates.bottom) / 2,
				};
			}, CURSOR_MARKER);
			if (cursorCoordinates) await this._page.raw.mouse.move(cursorCoordinates.x, cursorCoordinates.y);
		}

		if (!opts?.skipAssertMarkdownValid) {
			await this.assertMarkdownValid();
		}
	}

	/** The article itself: one text box, holding the title as its first line and the body under it. */
	get body(): Locator {
		return this._page.raw.getByRole("textbox", {
			name: "Main content area, start typing to enter text.",
		});
	}

	/**
	 * Retypes the article's last paragraph — the whole body of a one-paragraph article.
	 *
	 * `setMarkdown` writes the file straight through the core, behind the app's command layer, so
	 * everything that refreshes on a command stays none the wiser. `GitIndexService` is one of those:
	 * its cached `git status` is what decides whether the publish panel asks for a diff at all, and
	 * the web build has no file watcher to correct it. Any scenario that goes on to look at git has
	 * to make its edit through the editor.
	 */
	async rewrite(text: string) {
		await this._waitForBody();
		// Triple-click takes that one paragraph. "Select all" would take the title with it, and
		// retyping the title makes the app reload the article out from under the typing.
		await this.body.getByRole("paragraph").last().click({ clickCount: 3 });
		await this.type(text);
		await this.forceSave();
	}

	/**
	 * The editor mounts with the title alone and fills the body in a tick later, so a click aimed at
	 * the body can land on the title instead. Waits until what is on disk is on screen.
	 */
	private async _waitForBody(): Promise<void> {
		const firstLine = (await this.markdown())
			.split("\n")
			.find((line) => line.trim())
			?.trim();
		if (firstLine) await expect(this.body.getByText(firstLine, { exact: true }).first()).toBeVisible();
	}

	async type(text: string) {
		await sleep(200);
		await this._page.raw.keyboard.type(text, { delay: 100 });
	}

	async press(keys: string) {
		for (const key of keys.split(" ")) {
			await this._page.raw.keyboard.press(key, { delay: 250 });
		}
	}

	async pasteHtml(html: string) {
		await this._page.raw.evaluate(async (h) => {
			const item = new ClipboardItem({
				"text/html": new Blob([h], { type: "text/html" }),
			});
			await navigator.clipboard.write([item]);
		}, html);
		await this.press("ControlOrMeta+V");
	}

	async pasteText(text: string) {
		await this._page.raw.evaluate(async (t) => {
			await navigator.clipboard.writeText(t);
		}, text);
		await this.press("ControlOrMeta+V");
	}

	async forceSave() {
		await this._page.raw.evaluate(async () => {
			await window.debug?.forceSave?.();
		});
	}

	async assertMarkdown(expected: string, opts?: AssertMdOpts) {
		await this.forceSave();

		if (!opts?.skipAssertMarkdownValid) {
			await this.assertMarkdownValid();
		}

		const stripLeadingTabs = (s: string) => s.replace(/^\t+/gm, "");

		let clean = expected.replace(/\(\*\)/g, "").trim();
		if (opts?.ignoreTabs) clean = stripLeadingTabs(clean);

		// The same race `assertMarkdownContains` polls through: the editor writes its content
		// asynchronously, so a single read can land before the command under test has. Saving inside
		// the loop is the half that matters — what is on disk is only as fresh as the last save, so a
		// read that repeats without one just re-reads the same stale file.
		await expect(async () => {
			await this.forceSave();
			let cleanedMd = (await this.markdown()).replace(/[ \t]+$/gm, "").trim();
			if (opts?.ignoreTabs) cleanedMd = stripLeadingTabs(cleanedMd);
			expect(cleanedMd).toBe(clean);
		}).toPass({ timeout: 10_000 });
	}

	async assertMarkdownContains(expected: string | RegExp) {
		await this.forceSave();
		await this.assertMarkdownValid();
		const clean = expected instanceof RegExp ? expected : expected.replace(/\(\*\)/g, "").trim();
		// The editor writes its content asynchronously, so a single read races a paste or a command
		// that has not landed yet — poll until it settles.
		await expect(async () => {
			const md = (await this.markdown()).replace(/[ \t]+$/gm, "").trim();
			expected instanceof RegExp ? expect(md).toMatch(clean) : expect(md).toContain(clean);
		}).toPass({ timeout: 10_000 });
	}

	async assertMarkdownValid() {
		await expect(this._page.raw.getByText("Gramax couldn’t read the Markdown structure")).not.toBeVisible();
	}

	async clickToolbar(button: ToolbarButton) {
		const selector = toolbarIconMap[button];
		const toolbar = this._page.raw.getByTestId("editor-toolbar");
		await toolbar.locator(selector).click();
	}

	async hoverToolbar(button: ToolbarButton) {
		const selector = toolbarIconMap[button];
		const toolbar = this._page.raw.getByTestId("editor-toolbar");
		await toolbar.locator(selector).hover();
	}
}

export class CommentEditorPom extends EditorPom {
	constructor(page: BaseSharedPage) {
		super(page, "comment-editor");
	}
}
