import { catalogTest } from "@web/fixtures/catalog.fixture";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, type Locator, type Page } from "playwright/test";

/**
 * How a catalog with an OpenAPI block comes out on paper.
 *
 * The catalog next to this file is the reported case in miniature: an ordinary article, then an article
 * whose only content is a block whose `info.description` is longer than a page and opens with `# `. Printed,
 * that block used to land on one page box whole — the article title was left alone on the page before it,
 * a thousand pixels of description went under `overflow: hidden`, and in print, where the clip is lifted,
 * the tail spilled over the page-number strip and onto the next sheet.
 *
 * Runnable only because `NO_PRINT` (base.fixture) stops the export just before `window.print()`: the
 * browser's dialog is modal and would hang the worker, while the paginated pages stay in the document.
 */
catalogTest.use({
	startUrl: "/print-layout/1-plain",
	dir: new URL(".", import.meta.url),
	isolated: true,
});

// Every scenario exports the whole catalog, and the catalog holds a 31-row table that is dealt out row by
// row — about twice what the default budget leaves once the worker has been running a while.
catalogTest.setTimeout(120_000);

// The preview is a bottom view that outlives the test unless dismissed — nothing reloads the page between
// scenarios in a worker, and the next test's seeding would run against a document the export is still
// rewriting.
catalogTest.afterEach(async ({ sharedPage }) => {
	const close = sharedPage.locator(".print-debug-close");
	if (await close.count()) await close.click();
	// Closing means unmounting every page box the export built, and on a loaded worker that outruns the
	// project's 7s default: the scenario that had already passed went red in its own cleanup. Given the
	// same patience the rest of the file gives the export.
	await expect(sharedPage.locator(".print-body")).toHaveCount(0, { timeout: 30_000 });
});

// Waited for, not just clicked: outside CI `actionTimeout` is 1200ms, and a menu that opens a frame late —
// which it does on a loaded machine — turns into a red test that has nothing to do with what is asserted.
const open = async (target: Locator) => {
	await expect(target).toBeVisible({ timeout: 30_000 });
	await target.click();
};

const exportCatalogToPdf = async (page: Page) => {
	// The page is shared by the worker, and a spec that ran before this one may have left the viewport
	// another size — which changes the article's width, the scale a wide table is fitted at, and therefore
	// how many pages anything takes. Everything asserted below is about pagination, so pagination is given
	// the same window every time.
	await page.setViewportSize({ width: 1280, height: 720 });
	await open(page.getByTestId("catalog-actions"));
	await open(page.getByRole("menuitem", { name: /Export/i }));
	await open(page.getByRole("menuitem", { name: /Catalog to PDF/i }));
	await open(page.getByRole("button", { name: /Open print dialog/i }));
	await expect(page.locator(".print-debug-preview")).toBeVisible({ timeout: 120_000 });
	await expect(page.locator(".print-body openapi-doc").first()).toBeVisible({ timeout: 60_000 });
};

catalogTest.describe("A catalog with an OpenAPI block in the PDF export", () => {
	catalogTest("Fills no page past its own height", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// A page box clips on screen and stops clipping in print, so content that does not fit is not lost —
		// it is printed over the page's own footer and over the sheet boundary. Overflow here is the defect
		// itself, measured where it happens rather than through what it looks like afterwards.
		const overflow = await sharedPage.evaluate(() =>
			[...document.querySelectorAll(".print-body > .page > .page-content")]
				.map((content, index) => ({ index, over: content.scrollHeight - content.clientHeight }))
				.filter((page) => page.over > 1),
		);

		expect(overflow).toEqual([]);
	});

	catalogTest("Opens the block on the page its article title opens", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// "A new article starts a new page" is the rule; "and then the page stays empty" is not. The block
		// could not start on the title's page while it was indivisible, so the title got a page to itself.
		// Not merely "an openapi-doc is on that page": the paginator clones the shell as page chrome, so an
		// empty one can sit beside the title while the document itself starts overleaf — which is the defect,
		// exactly as it looked. What has to be there is the block's own beginning.
		const titlePage = await sharedPage.evaluate(() => {
			const pages = [...document.querySelectorAll(".print-body > .page")];
			const page = pages.find((candidate) =>
				[...candidate.querySelectorAll("h1")].some((heading) =>
					heading.textContent?.includes("Статья с OpenAPI"),
				),
			);
			const text = page?.textContent ?? "";
			return {
				found: !!page,
				apiTitle: text.includes("Массовый импорт конфигураций"),
				descriptionStart: text.includes("Оркестратор позволяет создавать данные на Платформе"),
			};
		});

		expect(titlePage).toEqual({ found: true, apiTitle: true, descriptionStart: true });
	});

	catalogTest("Spreads the description over as many pages as it needs", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// The description alone is longer than a page. Splitting it means its own box repeats as page chrome,
		// so the text keeps the description's width, size and colour on every page it runs onto.
		const spread = await sharedPage.evaluate(() => {
			const pages = [...document.querySelectorAll(".print-body > .page")];
			const holding = (selector: string) => pages.filter((page) => page.querySelector(selector)).length;
			return { block: holding("openapi-doc"), description: holding(".description") };
		});

		expect(spread.block).toBeGreaterThan(1);
		expect(spread.description).toBeGreaterThan(1);
	});

	catalogTest("Reads a heading in the spec as content, not as an article", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// `# ` at the top of an `info.description` is how specs are written, and Markdown in an article never
		// produces an `h1` — the article title owns that level. The description went through a different
		// renderer, so it did, and `h1` is exactly what the export reads as "start a new page here".
		const headings = await sharedPage.evaluate(() =>
			[...document.querySelectorAll(".print-body openapi-doc .description :is(h1,h2,h3,h4,h5,h6)")].map(
				(heading) => ({
					tag: heading.tagName.toLowerCase(),
					breakBefore: getComputedStyle(heading).breakBefore,
				}),
			),
		);

		expect(headings.length).toBeGreaterThan(0);
		expect(headings.filter((heading) => heading.tag === "h1")).toEqual([]);
		expect(headings.filter((heading) => heading.breakBefore === "page")).toEqual([]);
	});

	catalogTest(
		"Keeps every part of the description, not only the parts a counter watches",
		async ({ sharedPage, basePage }) => {
			await basePage.waitForLoad();
			await exportCatalogToPdf(sharedPage);

			// Rows and code lines are counted elsewhere, and a description that lost its paragraphs and lists
			// would still satisfy both of those and still spread over several pages. These are one anchor from
			// every kind of block the description is made of, in the order they appear in the spec.
			const anchors = [
				"Особенности API",
				"Оркестратор позволяет создавать данные на Платформе",
				"регистрация устройства",
				"создание правил МСЭ",
				"Аутентификация",
				"p12-сертификат",
				"Авторизация",
				"Файлы",
				"networks_input.csv",
				"Проверка выполнения",
				"Полный ответ метода проверки",
				"Примеры CSV",
				"bankomat-ce10b-SPOKE-1",
			];

			// Read from the description's own fragments and nowhere else: half of these words appear again in
			// the operations below — "создание правил МСЭ" is also the summary of POST /rules — so a search
			// over the whole page would stay green while the list item that says it was dropped.
			const found = await sharedPage.evaluate((needles: string[]) => {
				const text = [...document.querySelectorAll(".print-body openapi-doc .description")]
					.map((part) => part.textContent ?? "")
					.join("\n");
				return needles.map((needle) => text.indexOf(needle));
			}, anchors);

			expect(anchors.filter((_, index) => found[index] < 0)).toEqual([]);
			// And in the order the spec writes them: a fragment dealt onto the wrong page would still be found.
			expect(found).toEqual([...found].sort((left, right) => left - right));
		},
	);

	catalogTest("Deals a long description table out row by row", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// The CSV example in the description is 31 rows -- longer than a page, as customer specs are. Nothing
		// in the print pipeline recognised a Markdown table (the article's own handler goes by
		// `data-component="table"`, which markdown-it never writes), so it was placed whole and clipped.
		// Splitting it means the header row is repeated on each part, and every page has to budget for it.
		// `cpe_template` is a column of the long example only -- the description holds a second, short table
		// whose parts would otherwise be counted here and make "split into parts" true without splitting.
		const table = await sharedPage.evaluate(() => {
			const parts = [...document.querySelectorAll<HTMLElement>(".print-body > .page table")].filter((part) =>
				part.querySelector("thead")?.textContent?.includes("cpe_template"),
			);
			return {
				parts: parts.length,
				rows: parts.reduce((sum, part) => sum + part.querySelectorAll("tbody tr").length, 0),
				withoutHeader: parts.filter((part) => !part.querySelector("thead th")).length,
			};
		});

		expect(table.parts).toBeGreaterThan(1);
		expect(table.rows).toBe(31);
		expect(table.withoutHeader).toBe(0);
	});

	catalogTest("Deals a long code block out line by line", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// Splitting a code block is `CodeBlockPaginator`'s job, and it deals out `.code-line` elements from a
		// `.child-wrapper` — markup the article renderer builds while it highlights, and markdown-it does not.
		// The first description code block too tall for what was left of a page took the whole export down
		// with an assertion, so the description's blocks are given that shape before the page is measured.
		const code = await sharedPage.evaluate(() => {
			const blocks = [...document.querySelectorAll(".print-body > .page pre")];
			const lines = blocks.flatMap((block) => [...block.querySelectorAll(".code-line")]);
			return {
				blocks: blocks.length,
				rows: lines.filter((line) => (line.textContent ?? "").includes('"row')).length,
				pages: new Set(
					blocks.map((block) =>
						[...document.querySelectorAll(".print-body > .page")].findIndex((page) => page.contains(block)),
					),
				).size,
			};
		});

		// 32 rows in the long sample, none of them lost, and it did not fit on one page.
		expect(code.rows).toBe(32);
		expect(code.pages).toBeGreaterThan(1);

		// And only what the host rendered: the viewer's own samples are its markup, already highlighted, and
		// are left alone. `markdown` is the class it puts on everything it fills with renderMarkdown output.
		const viewerSamples = await sharedPage.evaluate(() =>
			[...document.querySelectorAll(".print-body openapi-doc pre")]
				.filter((block) => !block.closest(".markdown"))
				.map((block) => ({
					lines: block.querySelectorAll(".code-line").length,
					tokens: block.querySelectorAll("span[class^='hljs-']").length,
				})),
		);

		expect(viewerSamples.length).toBeGreaterThan(0);
		expect(viewerSamples.filter((sample) => sample.lines > 0)).toEqual([]);
		expect(viewerSamples.filter((sample) => sample.tokens > 0).length).toBeGreaterThan(0);
	});

	catalogTest("Fits a wide table even when the block itself fits", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// Scaling a wide table happens on the way into the block's paginator, and a block short enough to be
		// placed whole never reaches it: the fit check comes first. The columns then run off the side of the
		// sheet — which nothing measuring heights can see.
		const overhang = await sharedPage.evaluate(() =>
			[...document.querySelectorAll(".print-body > .page")].flatMap((page) => {
				const content = page.querySelector(".page-content") as HTMLElement;
				const right = content.getBoundingClientRect().right;
				return [...page.querySelectorAll(".openapi-table-scroll table")]
					.map((table) => Math.round(table.getBoundingClientRect().right - right))
					.filter((over) => over > 1);
			}),
		);

		// The marker sits in the last column of the short spec's table — the column that runs off the page
		// when the table is not scaled. Read from the text rather than through a visibility check: at the
		// scale a 18-column table is fitted at, waiting for a locator to call that cell visible takes a
		// minute and proves nothing extra.
		const lastColumn = await sharedPage.evaluate(
			() => document.querySelector(".print-body")?.textContent?.includes("ZZTOPMARK") ?? false,
		);

		expect(overhang).toEqual([]);
		expect(lastColumn).toBe(true);
	});

	catalogTest(
		"Spreads a long tag description the way it spreads the document's",
		async ({ sharedPage, basePage }) => {
			await basePage.waitForLoad();
			await exportCatalogToPdf(sharedPage);

			// A tag's description is the same Markdown as the document's and gets as long. It reached the page
			// through the same indivisible run the document description used to.
			const tagPages = await sharedPage.evaluate(() => {
				const pages = [...document.querySelectorAll(".print-body > .page")];
				return {
					holding: pages.filter((page) => page.querySelector(".section-desc")).length,
					end: pages.some((page) => (page.textContent ?? "").includes("SENTINEL-TAG-END")),
				};
			});

			expect(tagPages.end).toBe(true);
			expect(tagPages.holding).toBeGreaterThan(1);
		},
	);

	catalogTest("Leaves the screen's own controls off the paper", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// Nothing on paper can be clicked. Search, Authorize, the button that copies the server URL and the
		// list behind the server switch are all affordances; the one thing a reader needs — which server the
		// document is written against — is printed either way.
		const controls = await sharedPage.evaluate(() => {
			const shown = (selector: string) =>
				[...document.querySelectorAll(`.print-body openapi-doc ${selector}`)].filter(
					(el) => getComputedStyle(el).display !== "none",
				).length;
			const trigger = document.querySelector(".print-body openapi-doc .server-switch-trigger");
			return {
				search: shown(".search-field"),
				authorize: shown(".auth-button"),
				copy: shown(".copy"),
				serverOptions: shown(".server-options"),
				// What is left of the switch is a line of text; the chevron would still say it opens.
				switchChevron: shown(".server-switch-trigger > svg"),
				// The article styles every <details> with a marker of its own — a Font Awesome plus, which on
				// paper has no font behind it and prints as a literal "+" in the margin beside the server.
				switchMarker: trigger ? getComputedStyle(trigger, "::before").content : "missing",
			};
		});

		expect(controls).toEqual({
			search: 0,
			authorize: 0,
			copy: 0,
			serverOptions: 0,
			switchChevron: 0,
			switchMarker: "none",
		});
	});

	catalogTest("Fills a page before opening the next one", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// A page that still has room while the block continues overleaf means the budget said no when it had
		// room to say yes. That is how a NaN in the running total shows up: `Math.max(undefined, margin)` is
		// NaN, every later "does this fit" is false, and each element opens a page of its own.
		const sparse = await sharedPage.evaluate(() => {
			const pages = [...document.querySelectorAll(".print-body > .page")];
			return pages
				.map((page, index) => {
					const content = page.querySelector(".page-content") as HTMLElement;
					const children = [...content.children] as HTMLElement[];
					const last = children[children.length - 1];
					const used = last ? last.getBoundingClientRect().bottom - content.getBoundingClientRect().top : 0;
					// The same run, not merely another block: a page whose successor opens an article starts
					// that article, and stopping early there is the rule, not a defect.
					const next = pages[index + 1];
					const continues =
						!!page.querySelector("openapi-doc") &&
						!!next?.querySelector("openapi-doc") &&
						!next.querySelector("h1");
					return { page: index + 1, filled: Math.round((used / content.clientHeight) * 100), continues };
				})
				.filter((page) => page.continues && page.filled < 60)
				.map((page) => `${page.page}: ${page.filled}%`);
		});

		expect(sparse).toEqual([]);
	});

	catalogTest("Prints on white paper whatever theme the reader is in", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();

		// The reader's own setting, not a class written by hand: the app reads it at boot and writes the
		// theme onto the document — a class on <html>, an attribute on <body> (Theme/utils.ts) — and
		// everything downstream keys off those two ancestors, including the viewer package, whose dark
		// palette is `:is(.dark, [data-theme="dark"]) openapi-doc`.
		await sharedPage.evaluate(() => {
			const key = "app-settings-cache";
			const cache = JSON.parse(window.localStorage.getItem(key) ?? '{"state":{"values":{}},"version":1}');
			cache.state = cache.state ?? {};
			cache.state.values = cache.state.values ?? {};
			cache.state.values.general = { ...cache.state.values.general, theme: "dark" };
			window.localStorage.setItem(key, JSON.stringify(cache));
		});
		await sharedPage.reload();
		await basePage.waitForLoad();
		await expect.poll(() => sharedPage.evaluate(() => document.documentElement.className)).toBe("dark");

		await exportCatalogToPdf(sharedPage);

		// Nothing about exporting changes what the reader is looking at. The theme lives on the document
		// itself, so switching it to get a white sheet would repaint the whole app in front of them.
		expect(await sharedPage.evaluate(() => document.documentElement.className)).toBe("dark");

		// A colour is light or dark by its luminance, not by which token it came from.
		const ink = () =>
			sharedPage.evaluate(() => {
				const luminance = (colour: string) => {
					const [red, green, blue] = (colour.match(/[\d.]+/g) ?? ["0", "0", "0"]).map(Number);
					return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
				};
				const page = document.querySelector(".print-body > .page") as HTMLElement;
				const probe = document.createElement("div");
				probe.style.background = "var(--color-article-bg)";
				page.appendChild(probe);
				const paper = luminance(getComputedStyle(probe).backgroundColor);
				probe.remove();

				const doc = document.querySelector(".print-body openapi-doc") as HTMLElement;
				return {
					paper,
					text: luminance(getComputedStyle(page).color),
					block: luminance(getComputedStyle(doc).backgroundColor),
					blockText: luminance(getComputedStyle(doc).color),
				};
			});

		const onScreen = await ink();
		await sharedPage.emulateMedia({ media: "print" });
		const onPaper = await ink();
		await sharedPage.emulateMedia({ media: null });

		// On screen the copy belongs to the reader's theme, like everything else in the window.
		expect(onScreen.paper).toBeLessThan(0.3);
		expect(onScreen.blockText).toBeGreaterThan(0.7);

		// On paper it is dark ink on white, and print media is the whole of what got it there: every dark
		// block in the palette is written `@media not print`, the package's own included.
		expect(onPaper.paper).toBeGreaterThan(0.9);
		expect(onPaper.block).toBeGreaterThan(0.9);
		expect(onPaper.text).toBeLessThan(0.3);
		expect(onPaper.blockText).toBeLessThan(0.3);

		await sharedPage.locator(".print-debug-close").click();
		await expect(sharedPage.locator(".print-body")).toHaveCount(0);
		expect(await sharedPage.evaluate(() => document.documentElement.className)).toBe("dark");

		// Left as the file found it: the scenarios after this one export in the default theme.
		await sharedPage.evaluate(() => {
			const key = "app-settings-cache";
			const cache = JSON.parse(window.localStorage.getItem(key) ?? '{"state":{"values":{}},"version":1}');
			cache.state.values.general = { ...cache.state.values.general, theme: "light" };
			window.localStorage.setItem(key, JSON.stringify(cache));
		});
		await sharedPage.reload();
		await basePage.waitForLoad();
	});

	catalogTest("Prints one numbered sheet per page box", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		const boxes = await sharedPage.locator(".print-body > .page").count();
		// The options the CLI's exporter passes (gramax-export-pdf). `preferCSSPageSize` takes the sheet from
		// the stylesheet, which is why the stylesheet names one: without it this fell through to Letter, where
		// the page box is taller than what gets printed and the footer goes over the edge.
		const pdf = await sharedPage.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });

		// The number in the bottom strip is a CSS counter, so it reaches paper as ordinary text. Everything
		// this asserts -- a sheet per box, one number on it, numbers running 1..N -- is what the export got
		// wrong: a box that overflowed pushed its own strip onto the next sheet, and the viewer's
		// `<main class="page">` incremented the counter, so the numbers skipped.
		const document = await getDocument({ data: new Uint8Array(pdf) }).promise;
		const sheets: {
			size: { width: number; height: number };
			footer: { page: number; y: number; right: number }[];
			left: number;
		}[] = [];
		for (let index = 1; index <= document.numPages; index++) {
			const sheet = await document.getPage(index);
			const view = sheet.getViewport({ scale: 1 });
			const text = await sheet.getTextContent();
			const items = text.items.filter(
				(item): item is { str: string; width: number; transform: number[] } =>
					"str" in item && item.str.trim().length > 0,
			);
			sheets.push({
				size: { width: view.width, height: view.height },
				footer: items
					// The strip's own corner — bottom eighth, to the right of article content. Content reaches
					// that low, and a table's last column reaches that far right, but nothing does both.
					.filter((item) => item.transform[5] < view.height / 8 && item.transform[4] > view.width * 0.8)
					.filter((item) => /^\d+$/.test(item.str.trim()))
					.map((item) => ({
						page: Number(item.str.trim()),
						y: Math.round(item.transform[5]),
						right: item.transform[4] + item.width,
					})),
				left: Math.min(...items.map((item) => item.transform[4])),
			});
		}

		expect(document.numPages).toBe(boxes);
		// A4 — 595.28 x 841.89pt — because the stylesheet says so and the exporter asks for what the stylesheet
		// says. Within a few points: which way Chrome rounds depends on the options it was handed.
		for (const sheet of sheets) {
			expect(sheet.size.width).toBeCloseTo(595.28, -1);
			expect(sheet.size.height).toBeCloseTo(841.89, -1);
		}
		expect(sheets.map((sheet) => sheet.footer.map((item) => item.page))).toEqual(
			Array.from({ length: boxes }, (_, index) => [index + 1]),
		);
		// Every number at the same height: one box to one sheet, none of them creeping up the page as the
		// document goes on, which is what happens when a box is shorter than the sheet and they run together.
		expect(new Set(sheets.map((sheet) => sheet.footer[0]?.y)).size).toBe(1);

		// The same margin on both sides of every sheet. The number closes the column on the right; on the left
		// the column opens with the first article, which is plain text. The box used to be narrower than the
		// sheet and printed against its left edge: 0pt on the left, 34 on the right.
		// Within a point: a glyph's side bearing is not the column's edge, and the two ends of it are different glyphs.
		const rightMargin = sheets[0].size.width - sheets[0].footer[0].right;
		for (const sheet of sheets)
			expect(Math.abs(sheet.size.width - sheet.footer[0].right - rightMargin)).toBeLessThan(1);
		expect(Math.abs(sheets[0].left - rightMargin)).toBeLessThan(1);
		// A margin and not a hairline: 5mm is about 14pt.
		expect(rightMargin).toBeGreaterThan(14);
	});

	catalogTest("Counts pages, and nothing that merely calls itself one", async ({ sharedPage, basePage }) => {
		await basePage.waitForLoad();
		await exportCatalogToPdf(sharedPage);

		// The viewer names its own document container `<main class="page">`. The page counter is a CSS
		// counter incremented by `.page`, and that container sits inside the page content, ahead of the strip
		// that prints the number — so every page holding a block printed the next page's number, and every
		// page after it was off by one.
		const counted = await sharedPage.evaluate(() => {
			const body = document.querySelector(".print-body")!;
			const real = [...body.children].filter((el) => el.classList.contains("page"));
			const counting = [...body.querySelectorAll(".page")].filter(
				(el) => getComputedStyle(el).counterIncrement !== "none",
			);
			return {
				real: real.length,
				extra: counting
					.filter((el) => !real.includes(el))
					.map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().split(" ")[0]}`),
			};
		});

		expect(counted.extra).toEqual([]);
		expect(counted.real).toBeGreaterThan(2);
	});
});
