import { catalogTest } from "@web/fixtures/catalog.fixture";
import type { FileTree } from "@web/utils";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, type Locator, type Page } from "playwright/test";

/**
 * What an ordinary catalog — no OpenAPI, no wide tables, nothing but text — comes out as on paper.
 *
 * The export lays every article out in page boxes of its own and scales those boxes onto the sheet. The two
 * defects behind this file are what that scaling and that copy did to a reader: the box is fitted by its
 * height and is narrower than the sheet, and all 12mm of the difference went to one side, so every page came
 * out with its text against the left margin and a blank band down the right; and the copy being measured
 * painted in the window while it was being dealt out, so the catalog scrolled past behind the export dialog
 * for as long as the export ran.
 *
 * Runnable only because `NO_PRINT` (base.fixture) stops the export just before `window.print()`: the
 * browser's dialog is modal and would hang the worker, while the paginated pages stay in the document.
 */

/**
 * How long the export is allowed to honestly take. Named budgets (`@utils/budgets`) landed in develop after
 * this release branch was cut, so the numbers stand here as literals, the way the neighbouring print specs
 * on this branch write them.
 */
const PRINT_CATALOG = 120_000;
const PRINT_PREVIEW = 60_000;

const PARAGRAPHS_PER_ARTICLE = 16;

const paragraph = (article: number, index: number) =>
	`Абзац ${index} статьи ${article}. ${"Текст здесь набран ради высоты страницы, а не ради смысла: экспорту нужен каталог, который не помещается на один лист. ".repeat(
		3,
	)}`;

const articleFile = (article: number, title: string) =>
	[
		`---\ntitle: "${title}"\n---`,
		...Array.from({ length: PARAGRAPHS_PER_ARTICLE }, (_, index) => paragraph(article, index + 1)),
	].join("\n\n");

catalogTest.use({
	startUrl: "/print-sheet",
	files: {
		"print-sheet": {
			".doc-root.yml": "title: Print Sheet\nsyntax: xml\nsupportedLanguages: []\n",
			"_index.md": '---\ntitle: "Print Sheet"\n---\n\nКорень каталога.\n',
			"1-first.md": articleFile(1, "Первая статья"),
			"2-second.md": articleFile(2, "Вторая статья"),
			"3-third.md": articleFile(3, "Третья статья"),
			"4-fourth.md": articleFile(4, "Четвёртая статья"),
		} satisfies FileTree,
	},
});

// Every scenario exports the whole catalog, which is several pages of text dealt out node by node.
catalogTest.setTimeout(120_000);

// The preview is a bottom view that outlives the test unless dismissed — nothing reloads the page between
// scenarios in a worker, and the next one would run against a document the export is still rewriting.
catalogTest.afterEach(async ({ sharedPage }) => {
	const close = sharedPage.locator(".print-debug-close");
	if (await close.count()) await close.click();
	await expect(sharedPage.locator(".print-body")).toHaveCount(0, { timeout: PRINT_PREVIEW });
});

// Waited for, not just clicked: outside CI `actionTimeout` is 1200ms, and a menu that opens a frame late —
// which it does on a loaded machine — turns into a red test that has nothing to do with what is asserted.
const open = async (target: Locator) => {
	await expect(target).toBeVisible();
	await target.click();
};

/** Up to the dialog and no further: the export itself is one more click, which two scenarios time. */
const openExportDialog = async (page: Page) => {
	// The page is shared by the worker, and a spec that ran before may have left the viewport another size,
	// which changes the article's width and therefore how many pages anything takes.
	await page.setViewportSize({ width: 1280, height: 720 });
	await open(page.getByTestId("catalog-actions"));
	await open(page.getByRole("menuitem", { name: /Export/i }));
	await open(page.getByRole("menuitem", { name: /Catalog to PDF/i }));
	await expect(page.getByRole("button", { name: /Open print dialog/i })).toBeVisible();
};

const exportCatalogToPdf = async (page: Page) => {
	await openExportDialog(page);
	await open(page.getByRole("button", { name: /Open print dialog/i }));
	await expect(page.locator(".print-debug-preview")).toBeVisible({ timeout: PRINT_CATALOG });
	await expect(page.locator(".print-body > .page").first()).toBeVisible({ timeout: PRINT_PREVIEW });
};

/** One reading of the paginated copy, taken inside the page on an animation frame. */
type ExportFrame = { copy: number; visibility: string; preview: boolean };

/**
 * Starts watching the copy the paginator measures, one reading per animation frame, from inside the page.
 *
 * Sampled from the test instead -- a screenshot of the window, a count of the copy, another screenshot --
 * a single turn costs about a tenth of a second, and this catalog paginates in about the same: on the run
 * this was written against the export was finished 130ms after the click, so the loop took one sample, found
 * the preview already up and had nothing to assert on. The paginator yields to a frame between chunks
 * (`createChunkScheduler`), so a frame-by-frame observer inside the page cannot be outrun by it.
 *
 * `visibility` and not a picture: it is exactly what the fix sets and exactly what "the reader does not see
 * it" means -- a hidden element paints nothing, wherever on screen it happens to be. The band of pixels this
 * scenario used to compare instead had to be placed by hand below the export dialog, and the dialog's own
 * footer -- a spinner and a ticking percentage while the export runs -- moved inside it.
 */
const watchExport = (page: Page) =>
	page.evaluate(() => {
		const frames: { copy: number; visibility: string; preview: boolean }[] = [];
		(window as unknown as { gramaxExportFrames: typeof frames }).gramaxExportFrames = frames;
		const started = performance.now();

		const tick = () => {
			// The view is portalled onto body and carries the class the export hides it with; `.print-body`,
			// where the dealt pages land, is rendered with it and is the one part of it that is never renamed.
			const view = document.querySelector(".print-body")?.closest<HTMLElement>(".article-body");
			if (view) {
				const preview = view.classList.contains("print-debug-preview");
				frames.push({
					copy: document.querySelectorAll(".render-body .page-content > *").length,
					visibility: getComputedStyle(view).visibility,
					preview,
				});
				// The preview is the export showing itself on purpose -- past it there is nothing to watch.
				if (preview) return;
			}
			if (performance.now() - started < 180_000) requestAnimationFrame(tick);
		};

		requestAnimationFrame(tick);
	});

const exportFrames = (page: Page): Promise<ExportFrame[]> =>
	page.evaluate(() => (window as unknown as { gramaxExportFrames?: ExportFrame[] }).gramaxExportFrames ?? []);

/**
 * How far the page number ends short of its own page box, in box pixels — the rightmost thing the export puts
 * on a page, and the only one whose distance to the box's edge is a number and not a guess about a font.
 */
const numberGapsInBoxes = (page: Page) =>
	page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>(".print-body > .page")].map((box) => {
			const strip = box.querySelector<HTMLElement>(".page-bottom-right");
			const boxRect = box.getBoundingClientRect();
			const stripRect = strip.getBoundingClientRect();
			return { width: boxRect.width, height: boxRect.height, gap: boxRect.right - stripRect.right };
		}),
	);

type Sheet = {
	width: number;
	height: number;
	number: { value: number; right: number; baseline: number } | null;
};

/** The printed file, read back: every sheet's size and the page number printed in its bottom corner. */
const printedSheets = async (page: Page): Promise<Sheet[]> => {
	// The options the CLI's exporter passes (apps/cli/.../gramax-export-pdf). `preferCSSPageSize` takes the
	// sheet from the stylesheet, which is why the stylesheet names one.
	const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
	const document = await getDocument({ data: new Uint8Array(pdf) }).promise;

	const sheets: Sheet[] = [];
	for (let index = 1; index <= document.numPages; index++) {
		const sheet = await document.getPage(index);
		const view = sheet.getViewport({ scale: 1 });
		const text = await sheet.getTextContent();
		const numbers = text.items
			.filter((item): item is { str: string; width: number; transform: number[] } => "str" in item)
			// The strip's own corner — bottom eighth, to the right of article content. Content reaches that
			// low, and a line of text reaches that far right, but nothing does both.
			.filter((item) => item.transform[5] < view.height / 8 && item.transform[4] > view.width * 0.8)
			.filter((item) => /^\d+$/.test(item.str.trim()))
			.map((item) => ({
				value: Number(item.str.trim()),
				right: item.transform[4] + item.width,
				baseline: item.transform[5],
			}));

		sheets.push({ width: view.width, height: view.height, number: numbers[0] ?? null });
	}
	return sheets;
};

catalogTest.describe("A catalog in the PDF export", () => {
	catalogTest("Prints one sheet per page box, all of them A4", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		const boxes = await sharedPage.locator(".print-body > .page").count();
		const sheets = await printedSheets(sharedPage);

		// More than one, or the scenarios below would be reading a single sheet and calling it a document.
		expect(boxes).toBeGreaterThan(2);
		expect(sheets.length).toBe(boxes);
		// A4 — 595.28 x 841.89pt — within a few points: which way Chrome rounds depends on the options it
		// was handed. A box taller than the sheet is what shows up here, as a document one sheet too long.
		for (const sheet of sheets) {
			expect(sheet.width).toBeCloseTo(595.28, -1);
			expect(sheet.height).toBeCloseTo(841.89, -1);
		}
	});

	catalogTest("Centres the page box on the sheet, equal margin either side", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// The box is laid out at 900x1350 and printed at whatever scale fits its height onto the sheet, which
		// leaves the sheet wider than the box by 12mm. Where those 12mm go is the whole of this scenario:
		// split in two they are a margin, and left where they were they are a blank band down the right of
		// every page with the text shoved against the left edge.
		//
		// Read through the page number, the one element the export puts at the box's own edge: the paper
		// says where it printed, the layout says how far it sits from the edge of the box, and the two
		// together place the box on the sheet.
		const inBoxes = await numberGapsInBoxes(sharedPage);
		const sheets = await printedSheets(sharedPage);

		expect(sheets.length).toBe(inBoxes.length);
		expect(sheets.filter((sheet) => !sheet.number)).toEqual([]);

		const margins = sheets.map((sheet, index) => {
			// The box is printed at whatever scale puts its height onto the sheet's, so the sheet itself says
			// what one box pixel is worth and nothing has to be imported to find out.
			const box = inBoxes[index];
			const scale = sheet.height / box.height;
			const right = sheet.width - (sheet.number.right + box.gap * scale);
			const left = sheet.width - right - box.width * scale;
			return { sheet: index + 1, off: Math.round(left - right) };
		});

		expect(margins.filter((sheet) => Math.abs(sheet.off) > 2)).toEqual([]);
	});

	catalogTest("Prints the page number at the same height on every sheet", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		const sheets = await printedSheets(sharedPage);
		const baselines = new Set(sheets.map((sheet) => Math.round(sheet.number?.baseline ?? -1)));

		// One box to one sheet. When a box does not fit its sheet the boxes run together instead, each sheet
		// takes a little of the next, and the number climbs a little further up the page every time.
		expect(sheets.map((sheet) => sheet.number?.value)).toEqual(sheets.map((_, index) => index + 1));
		expect([...baselines]).toHaveLength(1);
	});

	catalogTest("Paginates out of the reader's sight", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await openExportDialog(sharedPage);

		// Watching starts before the export does: the view is mounted by the click below, and the first
		// frames of it are the ones worth having.
		await watchExport(sharedPage);
		await open(sharedPage.getByRole("button", { name: /Open print dialog/i }));
		await expect(sharedPage.locator(".print-debug-preview")).toBeVisible({ timeout: PRINT_CATALOG });

		const duringExport = (await exportFrames(sharedPage)).filter((frame) => !frame.preview);

		// Watched while there was something to see. Without this the scenario would pass on an export whose
		// copy never rendered, or on frames that were never taken at all.
		expect(duringExport.filter((frame) => frame.copy > 0).length).toBeGreaterThan(0);
		// And through all of it the copy painted nothing. The defect was the whole catalog being rendered a
		// second time in the window, page boxes appearing under the dialog one after another.
		expect([...new Set(duringExport.map((frame) => frame.visibility))]).toEqual(["hidden"]);
	});
});
