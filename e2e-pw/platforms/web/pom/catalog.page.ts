import type { TocItem } from "@gramax/core/extensions/navigation/article/logic/createTocItems";
import type { ArticleProps } from "@gramax/core/logic/FileStructue/Article/Article";
import { expect, type Locator } from "@playwright/test";
import { Dropdown } from "@shared-pom/dropdown";
import type { JSONContent } from "@tiptap/core";
import { addSubArticleButton, navItem } from "@utils/catalogTree";
import BasePage from "./base.page";
import { SearchPom } from "./search.pom";

export type ArticleContentDto = {
	md: string;
	html?: string;
	editTree?: JSONContent;
	toc?: TocItem[];
};

export default class CatalogPage extends BasePage {
	async currentArticleContent(markdownOnly: boolean = true): Promise<ArticleContentDto> {
		return await this.evaluateOnApp(async (markdownOnly) => {
			const app = await window.app!;
			const { catalogName, itemLogicPath } = window.debug.RouterPathProvider.parsePath(window.location.pathname);
			const catalog = await app.wm.current().getContextlessCatalog(catalogName!);
			const article = catalog.findArticle(itemLogicPath!.join("/"), []);
			// Missing while the route is still settling — throwing hands it back to the retry.
			if (!article) throw new Error(`article not mounted yet: ${window.location.pathname}`);

			if (markdownOnly) return { md: await article.getContent() };

			const parsedContent = await article.parsedContent.read();

			return {
				md: await article.getContent(),
				html: app.parser.getHtml(parsedContent.renderTree, parsedContent.parsedContext, window.location.origin),
				editTree: parsedContent.editTree,
				toc: parsedContent.tocItems,
			};
		}, markdownOnly);
	}

	async currentArticleProps(): Promise<ArticleProps> {
		return this.evaluateOnApp(async () => {
			const app = await window.app!;
			const { catalogName, itemLogicPath } = window.debug.RouterPathProvider.parsePath(window.location.pathname);
			const catalog = await app.wm.current().getContextlessCatalog(catalogName!);
			const article = catalog.findArticle(itemLogicPath!.join("/"), []);
			// Missing while the route is still settling — throwing hands it back to the retry.
			if (!article) throw new Error(`article not mounted yet: ${window.location.pathname}`);
			return article.props;
		}, undefined);
	}

	async getCatalogActions(): Promise<Dropdown> {
		const dropdown = new Dropdown(this._page, this._page.getByTestId("catalog-actions"));
		await dropdown.assertTriggerVisible();
		return dropdown;
	}

	async getCatalogProperties(): Promise<Dropdown> {
		const trigger = this._page.locator('[data-testid="catalog-properties"]:visible');
		if (!(await trigger.count())) {
			await this._page.getByTestId("catalog-properties-section-trigger").click();
			await expect(trigger).toBeVisible();
		}

		const dropdown = new Dropdown(this._page, trigger);
		await dropdown.assertTriggerVisible();
		return dropdown;
	}

	/**
	 * The left-navigation row for `title`.
	 *
	 * The row's own element carries `aria-label={title}`, so addressing it by label picks exactly
	 * one element per row — unlike matching by role, which differs between a top-level row (button)
	 * and a nested one (link). The chevron and the row's action buttons live inside it.
	 */
	/** The article tree, as its own landmark — the same title can also appear in the article itself. */
	get articleTree(): Locator {
		return this._page.getByRole("navigation", { name: "Catalog navigation" });
	}

	navItem(title: string): Locator {
		return this.articleTree.getByRole("button", { name: title, exact: true });
	}

	/** The chevron that expands or collapses a category row. */
	navItemChevron(title: string): Locator {
		return this.navItem(title).getByRole("button", {
			name: /^(Expand|Collapse)$/,
		});
	}

	/** The "next article" link under the article body. */
	get nextArticleLink(): Locator {
		return this._page.getByRole("link", { name: "Next article" });
	}

	search(): SearchPom {
		return new SearchPom(this);
	}

	async createChildArticle(parentTitle: string): Promise<void> {
		await navItem(this._page, parentTitle).hover();
		await addSubArticleButton(this._page, parentTitle).click();
		await this.waitForLoad();
	}

	async getArticleActions(title: string): Promise<Dropdown> {
		const item = this.navItem(title);
		await item.hover();

		const dropdown = new Dropdown(this._page, item.getByRole("button", { name: "Article actions" }));
		await dropdown.assertTriggerVisible();
		return dropdown;
	}

	/** Opens the item's action menu and picks "Configure", leaving the props modal open. */
	async openArticleProps(title: string): Promise<void> {
		const actions = await this.getArticleActions(title);
		await actions.open();
		await (await actions.findItemByTitle("Configure")).click();
		await expect(this.modal).toBeVisible();
	}

	/** Deletes a nav item through its action menu and confirms the alert. */
	async deleteNavItem(title: string): Promise<void> {
		const actions = await this.getArticleActions(title);
		await actions.open();
		await (await actions.findItemByTitle("Delete")).click();

		const dialog = this._page.getByRole("alertdialog");
		await expect(dialog).toBeVisible();
		// Sections append the nested-item count: "Delete" vs "Delete (3)".
		await dialog.getByRole("button", { name: /^Delete/ }).click();
		await expect(dialog).toBeHidden();
		await this.waitForLoad();
	}

	/** Opens catalog settings and, optionally, switches to one of its sidebar tabs. */
	async openCatalogSettings(tab?: string): Promise<void> {
		const actions = await this.getCatalogActions();
		await actions.open();
		await (await actions.findItemByTitle("Configure catalog")).click();

		await expect(this.modal.getByText("Catalog Settings", { exact: true })).toBeVisible();
		if (tab) await this.modal.getByRole("button", { name: tab, exact: true }).click();
	}

	async saveSettings(): Promise<void> {
		await this.modal.getByRole("button", { name: "Save" }).click();
		await expect(this.modal).toBeHidden();
		await this.waitForLoad();
	}

	async getNavTreeState(catalogName: string): Promise<string[]> {
		return this._page.evaluate((catalogName) => {
			const raw = window.localStorage.getItem("nav-tree-state");
			const stored = raw ? JSON.parse(raw) : {};
			const overrides: Record<string, boolean> = stored?.state?.catalogs?.[catalogName] ?? {};
			return Object.keys(overrides).filter((path) => overrides[path] === true);
		}, catalogName);
	}
}
