import { throwIfAborted } from "@ext/print/utils/pagination/abort";
import NodePaginator from "@ext/print/utils/pagination/NodePaginator";
import type Paginator from "@ext/print/utils/pagination/Paginator";
import PaginatorBase from "@ext/print/utils/pagination/Paginator";

/**
 * Splits one OpenAPI block across pages.
 *
 * Expanded for print the block is far taller than a page, and it is a single top-level article node, so
 * without a handler the paginator force-fits it whole: everything past the first page lands under the page
 * box's `overflow: hidden` and is silently lost. This paginates it the way a note is paginated — the chrome
 * around a list is cloned onto each new page and the list's items move into it one at a time — applied at
 * every level of the block that is a container around a list: the page shell, the header, the description,
 * the grid, a tag section whose operation cards do not fit together (see `stackOf` in openApiHandler).
 *
 * Clones carry `data-static`, which tells the viewer's custom elements they are page chrome and not a
 * document: an `<openapi-doc>` clone would otherwise reconnect and render itself as an empty one.
 */
const cloneChrome = <T extends HTMLElement>(node: T): T => {
	const clone = node.cloneNode(false) as T;
	// Ids are anchors into the document; a continuation is not the thing the anchor points at.
	clone.removeAttribute("id");
	if (clone.tagName.includes("-")) clone.setAttribute("data-static", "");
	return clone;
};

/**
 * A node whose chrome repeats on every page its content spills onto. `chain` is the wrappers this paginator
 * owns, outermost first; the last one holds the items that move.
 */
/**
 * Set on every copy of the chrome except the one the run ends in, for anything that should be drawn once at
 * the end and not on each page along the way — the rule under the document header, above all.
 */
export const CONTINUES_ATTRIBUTE = "data-print-continues";

abstract class ChainPaginator extends NodePaginator<HTMLElement> {
	private _outerContainer: HTMLElement;
	private _chromes: HTMLElement[] = [];
	/** The chrome of the page the run opens on — where headings that must not repeat are put back. */
	protected _firstChrome: HTMLElement;

	/** Wrappers this paginator repeats, outermost first. The innermost one receives the items. */
	protected abstract _chain(): HTMLElement[];

	async paginateNode() {
		const chain = this._chain();
		// Everything beside the list at each level — the document header, the operations heading, a section
		// head — opens the run and must not repeat on its continuations, so it is taken out of the way here
		// and put back into the first chrome once the items have been dealt out.
		const intro = chain
			.slice(0, -1)
			.map((wrapper, level) => [...wrapper.children].filter((child) => child !== chain[level + 1]));

		this._buildChrome();
		this._reserveFirstPageChrome(intro);
		await super.paginateSource(chain[chain.length - 1]);

		this.parentPaginator.currentContainer.appendChild(this._outerContainer);
		this.setMarginBottom();
		this.node.remove();

		let host = this._firstChrome;
		for (const children of intro) {
			// Prepending keeps the wrapper clone last, which is where the next level lives.
			children.reverse().forEach((child) => host.prepend(child));
			host = host.lastElementChild as HTMLElement;
		}

		// Which copy is the last one is only known once the run is over.
		for (const chrome of this._chromes) chrome.setAttribute(CONTINUES_ATTRIBUTE, "");
		this._outerContainer.removeAttribute(CONTINUES_ATTRIBUTE);
	}

	createPage() {
		this.parentPaginator.currentContainer.appendChild(this._outerContainer);
		this.cleanHeadingElementsIfNeed();
		throwIfAborted(PaginatorBase.controlInfo.signal);

		if (this.haveChildNodes()) this._buildChrome();
		else this._outerContainer.remove();

		this.parentPaginator.createPage();
		this._addChromeDimension();
		this.setHeadings();
		return this.currentContainer;
	}

	private _buildChrome() {
		const clones = this._chain().map(cloneChrome);
		clones.reduce((parent, child) => {
			parent.appendChild(child);
			return child;
		});
		this._outerContainer = clones[0];
		this.currentContainer = clones[clones.length - 1];
		this._firstChrome = this._firstChrome ?? this._outerContainer;
		this._chromes.push(this._outerContainer);
	}

	/**
	 * The first page is the one the intro opens on — the document header, the operations heading, a section
	 * head — but that content is put back only after the items have been dealt out, so pagination would fill
	 * the page against a height the page is not going to have. Reserving it here is what makes the first page
	 * obey the same budget as its continuations, which get their share through `_addChromeDimension` in
	 * `createPage`.
	 */
	private _reserveFirstPageChrome(intro: Element[][]) {
		this._addChromeDimension();
		const nodeDimension = PaginatorBase.paginationInfo.nodeDimension;
		for (const children of intro)
			for (const child of children) {
				const dimension = nodeDimension.get(child as HTMLElement);
				if (dimension) this.updateAccumulatedHeightDim(dimension);
			}
	}

	/**
	 * The repeated chrome takes vertical space of its own on the new page, and the first item on that page has
	 * to be measured against what is left of it.
	 *
	 * Everything the wrapper adds around its content counts, not only padding: `.doc-header` carries a 20px
	 * bottom margin and a rule under it, and a page that budgeted for neither fitted one element too many and
	 * printed it over its own footer.
	 */
	private _addChromeDimension() {
		const nodeDimension = PaginatorBase.paginationInfo.nodeDimension;
		const height = this._chain().reduce((sum, wrapper) => {
			const dimension = nodeDimension.get(wrapper);
			if (!dimension) return sum;
			return sum + dimension.paddingH + (dimension.borderH ?? 0) + dimension.marginTop + dimension.marginBottom;
		}, 0);
		if (!height) return;

		this.updateAccumulatedHeightDim({ height, marginTop: 0, marginBottom: 0, paddingH: height });
	}
}

/** One section — a tag group or Schemas: the head opens the run, the cards flow onto as many pages as needed. */
class OpenApiSectionPaginator extends ChainPaginator {
	private _wrappers: HTMLElement[];

	constructor(section: HTMLElement, stack: HTMLElement, parentPaginator: Paginator) {
		super(section, parentPaginator);
		this._wrappers = wrappersBetween(section, stack);
	}

	protected _chain(): HTMLElement[] {
		return this._wrappers;
	}
}

/** The block as a whole: the `<openapi-doc>` page shell repeats, its own children flow. */
export class OpenApiPaginator extends ChainPaginator {
	private _wrappers: HTMLElement[];

	constructor(block: HTMLElement, parentPaginator: Paginator) {
		super(block, parentPaginator);
		this._wrappers = wrappersBetween(block, contentHostOf(block));
	}

	static contentHost(node: HTMLElement): HTMLElement | null {
		return contentHostOf(node);
	}

	protected _chain(): HTMLElement[] {
		return this._wrappers;
	}
}

/**
 * The viewer's page shell. Its children are what flows: the header, the operations heading, the grid.
 *
 * It used to be the `.grid` inside it, which made everything above the grid a single indivisible run — and a
 * description longer than a page cannot be one. Each of those children is a container of its own and gets
 * split the same way when it has to (see `stackOf` in openApiHandler), so the shell is where the block stops
 * being one node and starts being a list.
 */
const contentHostOf = (block: HTMLElement): HTMLElement | null =>
	block.querySelector<HTMLElement>("openapi-doc > main.page");

/** The wrapper chain from `outer` down to `inner`, both included. */
const wrappersBetween = (outer: HTMLElement, inner: HTMLElement): HTMLElement[] => {
	// A container whose own children flow: one wrapper, no chain to walk. Walking would run past `outer` and
	// collect every ancestor up to the document.
	if (outer === inner) return [inner];

	const chain: HTMLElement[] = [inner];
	let node = inner.parentElement;
	while (node && node !== outer) {
		chain.unshift(node as HTMLElement);
		node = node.parentElement;
	}
	chain.unshift(outer);
	return chain;
};

export { OpenApiSectionPaginator };
export default OpenApiPaginator;
