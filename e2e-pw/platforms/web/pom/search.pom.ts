import { expect, type Locator } from "@playwright/test";
import type CatalogPage from "./catalog.page";

/**
 * The catalog search dialog. The trigger lives in the left-navigation top bar next to the
 * catalog actions.
 */
export class SearchPom {
	constructor(private _page: CatalogPage) {}

	get modal(): Locator {
		return this._page.raw.getByRole("dialog", { name: "Search" });
	}

	get input(): Locator {
		return this.modal.getByPlaceholder("Enter query");
	}

	/**
	 * A result row that navigates to the article itself (no fragment highlighting).
	 *
	 * This row carries no role: it is a plain click target that calls the router, and it already
	 * holds the breadcrumb links, so it can be neither a link nor a button without nesting them.
	 * Its title text is what identifies it.
	 */
	articleResult(title: string): Locator {
		return this.modal.getByText(title, { exact: true });
	}

	/** A result row for a matched fragment inside an article: opening it highlights that fragment. */
	fragmentResult(text: string): Locator {
		return this.modal.getByRole("link", { name: new RegExp(text, "i") });
	}

	async open(): Promise<void> {
		await this._page.raw.getByTestId("catalog-search-trigger").click();
		await expect(this.modal).toBeVisible();
	}

	async query(text: string): Promise<void> {
		await this.input.fill(text);
	}

	/** Waits for a result to show up (the index is built asynchronously) and opens it. */
	async openResult(result: Locator): Promise<void> {
		const first = result.first();
		await expect(first).toBeVisible({ timeout: 30_000 });
		await first.click();
		await expect(this.modal).toBeHidden();
		await this._page.waitForLoad();
	}
}
