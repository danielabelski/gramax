/**
 * @jest-environment jsdom
 *
 * What a fragment of a split paragraph costs the page it is put on.
 *
 * A paragraph taller than the page is dealt out a piece at a time, and each piece is measured with a Range —
 * which measures the text. The page draws line boxes: with a line height above the glyphs' own, a line of
 * text is shorter than the line it occupies, and a page that booked the text has room left that the sheet
 * does not.
 *
 * The font here is modelled rather than laid out: jsdom has no layout, so a Range reports the glyph box of
 * however many characters it holds, and the paragraph declares the line height the page will draw.
 */

import paragraphHandler from "@ext/markdown/elements/paragraph/print/paragraphHandler";
import { NodeDimensions } from "@ext/print/utils/pagination/NodeDimensions";
import PagePaginator from "@ext/print/utils/pagination/PagePaginator";
import Paginator from "@ext/print/utils/pagination/Paginator";
import { createPage } from "@ext/print/utils/pagination/pageElements";

jest.mock("@ext/print/utils/pagination/abort", () => ({
	throwIfAborted: jest.fn(),
}));

const LINE_HEIGHT = 20;
/** The glyphs of one line, which is what a Range reports — always less than the line box that holds them. */
const TEXT_BOX = 14;
const CHARS_PER_LINE = 10;
const PAGE_HEIGHT = 3 * LINE_HEIGHT;
const TAIL_HEIGHT = 6;
let inlineExtraHeight = 0;

Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
	configurable: true,
	get(this: HTMLElement) {
		return Number(this.dataset.h ?? 0);
	},
});

Range.prototype.getBoundingClientRect = function (this: Range) {
	const chars = this.endOffset - this.startOffset;
	if (chars <= 0) return { height: 0 } as DOMRect;
	const lines = Math.ceil(chars / CHARS_PER_LINE);
	return { height: (lines - 1) * LINE_HEIGHT + TEXT_BOX + inlineExtraHeight } as DOMRect;
};

/** A paragraph of so many lines, then blocks of the given heights, each marked with its own class. */
const buildSource = ({ lines, marginBottom, after }: { lines: number; marginBottom: number; after: number[] }) => {
	const source = document.createElement("div");
	const paragraph = document.createElement("p");
	paragraph.setAttribute("style", `line-height:${LINE_HEIGHT}px;margin:0 0 ${marginBottom}px`);
	paragraph.dataset.h = String(lines * LINE_HEIGHT + inlineExtraHeight);
	paragraph.textContent = "x".repeat(lines * CHARS_PER_LINE);
	source.appendChild(paragraph);

	after.forEach((height, index) => {
		const block = document.createElement("div");
		block.className = `after-${index}`;
		block.dataset.h = String(height);
		block.textContent = "после";
		source.appendChild(block);
	});

	return source;
};

const paginate = async (fixture: Parameters<typeof buildSource>[0]) => {
	const source = buildSource(fixture);
	document.body.appendChild(source);

	const pages = document.createElement("div");
	const yieldTick = jest.fn().mockResolvedValue(undefined);
	Paginator.controlInfo = {
		signal: undefined,
		progress: { increase: jest.fn(), emit: jest.fn() },
		yieldTick,
	} as never;
	Paginator.paginationInfo = {
		nodeDimension: await NodeDimensions.init(source, yieldTick),
		accumulatedHeight: NodeDimensions.createInitial(),
		printHandlers: { required: [], conditional: [paragraphHandler.handle] },
	} as never;
	Paginator.printPageInfo = { usablePageHeight: PAGE_HEIGHT, pages } as never;
	jest.spyOn(PagePaginator, "setUsablePageHeight").mockImplementation(() => undefined);

	const paginator = new PagePaginator(source, {
		paginationInfo: Paginator.paginationInfo,
		pages,
		controlInfo: Paginator.controlInfo,
	});
	await paginator.paginateNode(createPage(pages));
	source.remove();

	return [...pages.children].map((page) => {
		const content = page.querySelector<HTMLElement>(".page-content") ?? page;
		const lines = [...content.querySelectorAll("p")].reduce(
			(sum, part) => sum + Math.ceil((part.textContent ?? "").length / CHARS_PER_LINE),
			0,
		);
		const after = [...content.querySelectorAll<HTMLElement>("[class^='after-']")];
		// What the sheet draws, laid out by hand: the lines, the paragraph's margin when something follows
		// it on the page, and the blocks. A trailing margin draws nothing.
		const drawn =
			lines * LINE_HEIGHT +
			(lines && after.length ? fixture.marginBottom : 0) +
			after.reduce((sum, block) => sum + Number(block.dataset.h), 0);
		return { lines, after: after.map((block) => block.className), drawn };
	});
};

describe("A paragraph dealt out across pages is measured in line boxes", () => {
	afterEach(() => {
		inlineExtraHeight = 0;
	});

	// Three lines fill the page. Booked by their glyphs they measure 54 of the 60, and the six pixels that
	// are left are enough for what follows — which is then drawn past the edge of the sheet.
	test("a page filled with lines has no room left for what follows", async () => {
		const pages = await paginate({ lines: 6, marginBottom: 0, after: [TAIL_HEIGHT] });

		expect(pages.map(({ lines, after }) => ({ lines, after }))).toEqual([
			{ lines: 3, after: [] },
			{ lines: 3, after: [] },
			{ lines: 0, after: ["after-0"] },
		]);
	});

	// The tail of the paragraph takes two lines of the second page and its own 10px margin under them. The
	// running total counts every margin once, as part of what comes before it; a fragment that named its
	// margin without counting it had it subtracted by the next block all the same, and the page believed it
	// had 10px more than it had — 40 + 10 + 5 + 8 is 63 on a sheet of 60. Where exactly the two blocks go is
	// the fit check's business; that none of them is drawn past the sheet is this test's.
	test("the margin under the last fragment is taken off the page it is drawn on", async () => {
		const pages = await paginate({ lines: 4, marginBottom: 10, after: [5, 8] });

		for (const page of pages) expect(page.drawn).toBeLessThanOrEqual(PAGE_HEIGHT);
		expect(pages.reduce((sum, page) => sum + page.lines, 0)).toBe(4);
		expect(pages.flatMap((page) => page.after)).toEqual(["after-0", "after-1"]);
	});

	test("an inline element taller than its line is never booked below its measured height", async () => {
		inlineExtraHeight = 9;

		const pages = await paginate({ lines: 3, marginBottom: 0, after: [] });

		expect(pages.map(({ lines }) => lines)).toEqual([2, 1]);
	});
});
