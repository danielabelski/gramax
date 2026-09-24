import type { Locator, Page } from "@playwright/test";

// The catalog tree, addressed the way a user names it: by roles and accessible names. Functions
// take a page and hand back a locator; hovering, clicking and waiting stay in the spec, where the
// reader can see what the user does.

/** The tree landmark. The same title can appear in the article itself, so everything is scoped here. */
export const catalogNav = (page: Page): Locator => page.getByRole("navigation", { name: "Catalog navigation" });

/**
 * A tree row — a button named after the article, inside the tree's list item (a nested, unselected
 * row wraps the same button in a link). The list item is what tells an article titled "Add article"
 * apart from the tree's own "Add article" control.
 */
export const navItem = (page: Page, title: string): Locator =>
	catalogNav(page).getByRole("listitem").getByRole("button", { name: title, exact: true });

/** The standing "Add article" control under the last root article: the tree's own child, not a row. */
export const addRootArticleButton = (page: Page): Locator =>
	catalogNav(page)
		.locator(":scope > button")
		.and(page.getByRole("button", { name: "Add article", exact: true }));

/** The row's own "add a sub-article" button; the row reveals it on hover or focus. */
export const addSubArticleButton = (page: Page, parentTitle: string): Locator =>
	navItem(page, parentTitle).getByRole("button", { name: "Add a sub-article" });

/** The row's "Article actions" menu trigger; the row reveals it on hover or focus. */
export const articleActionsButton = (page: Page, title: string): Locator =>
	navItem(page, title).getByRole("button", { name: "Article actions" });
