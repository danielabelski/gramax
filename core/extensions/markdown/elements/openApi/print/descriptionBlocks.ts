import { TABLE_PORT_CLASS, TABLE_SCROLL_CLASS } from "@ext/markdown/elements/openApi/render/openApiMarkdown";

/** What `CodeBlockPaginator` deals out, and the box it deals them out of. */
const CODE_WRAPPER_CLASS = "child-wrapper";
const CODE_LINE_CLASS = "code-line";

/** The scrolling box around a Markdown table in a description — see render/openApiMarkdown.ts. */
const PORT_SELECTOR = `.${TABLE_PORT_CLASS}`;

/**
 * Takes the scroll port out from between the box and the table, and marks what is left as the article's
 * table wrapper.
 *
 * A description table has to be dealt out row by row like any other, and the paginator that does that
 * (`TablePaginator`) owns exactly one wrapper: it clones that wrapper per page and expects the table to be
 * its first child. Handing it the port instead would leave the outer box standing in the source — the
 * pagination loop reads `source.firstElementChild` until the source is empty, so it would read the same
 * node forever — and the printed fragments would lose `.openapi-table-scroll`, the ancestor that keeps
 * their cells from breaking mid-word.
 *
 * Two levels collapse into one instead. The port exists to scroll, and paper does not scroll; the outer box
 * keeps its class, and with `data-component="table"` on it the block is picked up by the article's own
 * table handler, with no special case anywhere in the print pipeline.
 */
export const unwrapScrollPorts = (block: HTMLElement): void => {
	for (const port of block.querySelectorAll<HTMLElement>(PORT_SELECTOR)) {
		const box = port.parentElement;
		if (!box?.classList.contains(TABLE_SCROLL_CLASS)) continue;

		box.dataset.component = "table";
		while (port.firstChild) box.insertBefore(port.firstChild, port);
		port.remove();
	}
};

/**
 * A scaled table is laid out in its own, wider coordinate space, so the first factor is a prediction: column
 * widths land on different sub-pixel boundaries there, and the page box a node is measured in is not always
 * the one it is finally dealt into. A second round measures what actually happened and takes off whatever is
 * still sticking out. Two is enough — the second measurement is already in the space the table will keep.
 */
const ROUNDS = 2;

/** Scale factors are kept at two decimals, always rounded down, so a fit is never off by the last fraction. */
const shrink = (factor: number, ratio: number): number => Math.floor(factor * ratio * 100) / 100;

/**
 * Scales an over-wide Markdown table in an OpenAPI description down until it fits the page.
 *
 * On screen such a table scrolls, which is what `openapi-viewer-theme.css` sets up. Paper has nowhere to
 * scroll: whatever leaves the page box is cut, and for an 18-column CSV example that is two thirds of the
 * table. Reflowing it into the page width instead is no better — the columns then have to break mid-word,
 * which is the thing being fixed in the first place.
 *
 * Scaling keeps both: every column present, every value on one line, just smaller — the way a reader zooms
 * out to take a wide sheet in. `zoom` and not `transform: scale`, because zoom reflows: the paginator
 * measures these blocks immediately after this pass and has to see the height the page will really have.
 *
 * The factor is exactly what it takes to fit, with no lower bound. A table wide enough to scale into
 * illegibility (roughly 25 columns and up) prints small, and that is the deliberate trade: a reader can zoom
 * into a PDF, but cannot recover a column that was never printed.
 */
export const fitWideTables = (block: HTMLElement): void => {
	const tables = [...block.querySelectorAll<HTMLTableElement>(`.${TABLE_SCROLL_CLASS} > table`)];
	if (!tables.length) return;

	const factors = new Array<number>(tables.length).fill(1);

	for (let round = 0; round < ROUNDS; round++) {
		// Every measurement first, every write after. Zooming inside the loop would relayout the document and
		// make each following table measure against a page it no longer occupies the same way.
		const ratios = tables.map((table) => {
			// The page gives the port its width; the table is what sticks out of it.
			const available = table.parentElement?.clientWidth ?? 0;
			if (!available || table.scrollWidth <= available) return 1;
			return available / table.scrollWidth;
		});
		if (ratios.every((ratio) => ratio === 1)) return;

		tables.forEach((table, index) => {
			if (ratios[index] === 1) return;
			factors[index] = shrink(factors[index], ratios[index]);
			table.style.setProperty("zoom", String(factors[index]));
		});
	}
};

/**
 * Gives a Markdown code block the shape the article's own code blocks have.
 *
 * Splitting one across pages is `CodeBlockPaginator`'s job, and it deals out `.code-line` elements from a
 * `.child-wrapper` — the markup the article renderer builds while it highlights. markdown-it writes
 * `<pre><code>…</code></pre>` and nothing else, so the paginator asserted its way out of the export the
 * first time a description's code block was too tall for what was left of a page.
 *
 * The same move as the tables above: hand the print pipeline the markup it already knows, instead of
 * teaching every paginator a second dialect. Lines are plain text — markdown-it does not highlight, and
 * paper does not need it to.
 */
export const normalizeCodeBlocks = (block: HTMLElement): void => {
	// Only what the host rendered. `markdown` is the class the viewer puts on every container it fills with
	// `renderMarkdown` output; its own code samples — request and response examples, cURL — are its markup,
	// already highlighted through `renderOpenApiCode`, and flattening those into plain lines would throw the
	// highlighting away for a shape nothing asked for.
	for (const pre of block.querySelectorAll(".markdown pre")) {
		if (pre.querySelector(`.${CODE_WRAPPER_CLASS}`)) continue;

		const source = pre.querySelector("code") ?? pre;
		const wrapper = document.createElement("div");
		wrapper.className = CODE_WRAPPER_CLASS;

		// A trailing newline is how a fence ends, not a line of its own.
		(source.textContent ?? "")
			.replace(/\n+$/, "")
			.split("\n")
			.forEach((text, index) => {
				// The wrapper preserves whitespace, and the paginator puts the same separator between the lines
				// it deals out, so a page break lands where a line break was.
				if (index) wrapper.appendChild(document.createTextNode("\n"));
				const line = document.createElement("span");
				line.className = CODE_LINE_CLASS;
				line.textContent = text;
				wrapper.appendChild(line);
			});

		pre.replaceChildren(wrapper);
	}
};

/** Everything a Markdown block in a description needs before the page it lands on is measured. */
export const prepareDescriptionBlocks = (block: HTMLElement): void => {
	unwrapScrollPorts(block);
	fitWideTables(block);
	normalizeCodeBlocks(block);
};

export default prepareDescriptionBlocks;
