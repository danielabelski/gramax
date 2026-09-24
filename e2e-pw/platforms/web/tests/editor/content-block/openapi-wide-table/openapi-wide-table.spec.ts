import { catalogTest } from "@web/fixtures/catalog.fixture";
import { expect, type Locator, type Page } from "playwright/test";

// The catalog next to this file is a customer spec whose `info.description` carries three CSV example tables,
// the widest 18 columns across. A Markdown table inside an OpenAPI description gets `.article table` — but
// none of what makes an article table work: no <colgroup>, no TableWrapper, nothing that scrolls. What is
// left is `display: block; width: 100%` and `word-break: break-word` on the cells, and that last one is the
// legacy alias of `overflow-wrap: anywhere`: every glyph becomes a wrap opportunity, so a column's minimum
// width is one character and an 18-column table fits any width at all — one letter per line, which is how
// this was reported. The three scenarios below are that failure written as invariants.
catalogTest.use({
	startUrl: "/wide-table/csv-tables",
	dir: new URL(".", import.meta.url),
	isolated: true,
});

// `rules_input.csv`, the third and widest example — 18 columns against an article column of ~750px.
const widestTable = (page: Page): Locator => page.locator('[data-testid="open-api"] .description table').nth(2);

/** The box that scrolls, and the one the shadows hang on. */
const widestScroll = (page: Page): Locator =>
	page.locator('[data-testid="open-api"] .description .openapi-table-scroll').nth(2);

// One line box per rendered line, and one part per run of text that has no place to break inside it. Text
// laid out narrower than its own longest part reports more of the first than of the second.
const measureCells = (table: Locator) =>
	table.evaluate((el: HTMLTableElement) =>
		[...el.querySelectorAll("th, td")]
			.map((cell) => {
				const text = cell.textContent?.trim() ?? "";
				const range = document.createRange();
				range.selectNodeContents(cell);
				return {
					text,
					lines: range.getClientRects().length,
					parts: text.split(/[\s\-/,]+/).filter(Boolean).length,
				};
			})
			.filter((cell) => cell.text),
	);

catalogTest.describe("Wide table in an OpenAPI description", () => {
	catalogTest("Keeps every column header on one line", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		const table = widestTable(sharedPage);
		await expect(table).toBeVisible();

		const headers = await table.evaluate((el: HTMLTableElement) =>
			[...el.querySelectorAll("thead th")].map((cell) => {
				const range = document.createRange();
				range.selectNodeContents(cell);
				return { text: cell.textContent?.trim(), lines: range.getClientRects().length };
			}),
		);

		expect(headers.filter((header) => header.lines !== 1)).toEqual([]);
	});

	catalogTest("Wraps a value at its separators and nowhere else", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		const table = widestTable(sharedPage);
		await expect(table).toBeVisible();

		const cells = await measureCells(table);

		expect(cells.filter((cell) => cell.lines > cell.parts)).toEqual([]);
	});

	catalogTest("Shades only the edge that still has content behind it", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		const scroll = widestScroll(sharedPage);
		await expect(scroll).toBeVisible();

		const shadeAt = (position: "start" | "end") =>
			scroll.evaluate((el: HTMLElement, where: string) => {
				const port = el.querySelector(".openapi-table-port") as HTMLElement;
				port.scrollLeft = where === "start" ? 0 : port.scrollWidth;
				return new Promise<{ left: boolean; right: boolean }>((resolve) => {
					// The watcher coalesces into a frame; two of them is past any single-frame debounce.
					requestAnimationFrame(() =>
						requestAnimationFrame(() =>
							resolve({
								left: el.hasAttribute("data-more-left"),
								right: el.hasAttribute("data-more-right"),
							}),
						),
					);
				});
			}, position);

		expect(await shadeAt("start")).toEqual({ left: false, right: true });
		expect(await shadeAt("end")).toEqual({ left: true, right: false });
	});

	catalogTest("Leaves what no longer fits reachable by scrolling", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		const table = widestTable(sharedPage);
		await expect(table).toBeVisible();

		const reach = await table.evaluate((el: HTMLTableElement) => {
			const port = el.parentElement as HTMLElement;
			port.scrollLeft = port.scrollWidth;
			return { outgrowsTheColumn: port.scrollWidth > port.clientWidth, lastColumnReached: port.scrollLeft > 0 };
		});

		expect(reach).toEqual({ outgrowsTheColumn: true, lastColumnReached: true });
	});
});

// Paper is the other half of the report: the reader's copy scrolls, the printed copy cannot, so a table wider
// than the page has to be fitted into it rather than cut off at the edge. `NO_PRINT` (set for every run in
// base.fixture) stops the export just before `window.print()`, leaving the paginated pages in the document.
catalogTest.describe("Wide table in a printed OpenAPI description", () => {
	catalogTest.afterEach(async ({ sharedPage }) => {
		const close = sharedPage.locator(".print-debug-close");
		if (await close.count()) await close.click();
		await expect(sharedPage.locator(".print-body")).toHaveCount(0);
	});

	catalogTest("Puts every column on the page", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await expect(sharedPage.locator('[data-testid="open-api"]')).toBeVisible();

		await sharedPage.getByTestId("catalog-actions").click();
		await sharedPage.getByRole("menuitem", { name: /Export/i }).click();
		await sharedPage.getByRole("menuitem", { name: /Catalog to PDF/i }).click();
		await sharedPage.getByRole("button", { name: /Open print dialog/i }).click();
		await expect(sharedPage.locator(".print-body")).toBeVisible({ timeout: 60_000 });

		const printed = sharedPage.locator(".print-body openapi-doc .markdown table").nth(2);
		await expect(printed).toBeAttached();

		const onPaper = await printed.evaluate((el: HTMLTableElement) => {
			const header = el.querySelector("th") as HTMLElement;
			const range = document.createRange();
			range.selectNodeContents(header);
			return {
				columnsCutOff: Math.max(0, el.scrollWidth - el.clientWidth),
				headerLines: range.getClientRects().length,
			};
		});

		expect(onPaper).toEqual({ columnsCutOff: 0, headerLines: 1 });
	});
});
