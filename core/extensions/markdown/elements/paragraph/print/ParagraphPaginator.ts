import { throwIfAborted } from "@ext/print/utils/pagination/abort";
import type { NodeDimensionsData } from "@ext/print/utils/pagination/NodeDimensions";
import NodePaginator from "@ext/print/utils/pagination/NodePaginator";
import Paginator from "@ext/print/utils/pagination/Paginator";
import someParentHaveChildNodes from "@ext/print/utils/pagination/utils/someParentHaveChildNodes";

/**
 * Pagination for paragraphs taller than the page height.
 *
 * Supports paragraphs with nested elements (tags like `<a>`, `<strong>`, `<em>`, etc.),
 * using Range to measure fragment heights.
 */
export class ParagraphPaginator {
	private _nodeDimension: NodeDimensionsData;

	constructor(
		private _node: HTMLParagraphElement,
		private _parentPaginator: Paginator,
	) {
		this._nodeDimension = Paginator.paginationInfo.nodeDimension.get(this._node);
	}

	async paginateNode() {
		throwIfAborted(Paginator.controlInfo.signal);

		const nodeDimension = Paginator.paginationInfo.nodeDimension;
		const dims = nodeDimension.get(this._node);

		if (!dims) {
			this._parentPaginator.tryFitElement(this._node, true);
			return;
		}

		const fullText = this._node.textContent ?? "";
		if (!fullText.trim().length) {
			this._parentPaginator.tryFitElement(this._node, true);
			return;
		}

		const totalCharCount = this._getTotalCharCount(this._node);

		const baseParagraph = this._node.cloneNode(false) as HTMLParagraphElement;

		let startCharIndex = 0;
		let currentPart = 0;

		while (startCharIndex < totalCharCount) {
			throwIfAborted(Paginator.controlInfo.signal);

			if (currentPart) this._parentPaginator.createPage();

			const { endCharIndex, height: segmentHeight } = this._findEndCharIndexForPage(
				this._node,
				startCharIndex,
				totalCharCount,
			);

			if (!currentPart && !this._checkCanUpdate(segmentHeight) && this._isSomeParentHaveChildNodes()) {
				this._parentPaginator.createPage();
				const tryFit = this._parentPaginator.tryFitElement(this._node);
				if (tryFit) return;
			}
			currentPart++;

			const segment = baseParagraph.cloneNode(false) as HTMLParagraphElement;
			this._setParagraphContent(segment, startCharIndex, endCharIndex);

			const pageContainer = this._parentPaginator.currentContainer;
			pageContainer.appendChild(segment);

			// Booked the way every other node is: the running total carries each margin once, as part of what
			// precedes it, and the next node takes the collapsed margin off it. A fragment that named its margin
			// without adding it lost it to the next node, and the page believed it had that much more room.
			Paginator.paginationInfo.accumulatedHeight = nodeDimension.updateAccumulatedHeightDim(
				{ ...dims, height: segmentHeight },
				Paginator.paginationInfo.accumulatedHeight,
			);

			startCharIndex = endCharIndex;

			if (currentPart % 2 === 0) {
				await Paginator.controlInfo.yieldTick();
				throwIfAborted(Paginator.controlInfo.signal);
			}
		}

		this._node.remove();
	}

	private _isSomeParentHaveChildNodes() {
		return (
			this._parentPaginator.haveChildNodes() ||
			(this._parentPaginator instanceof NodePaginator && someParentHaveChildNodes(this._parentPaginator))
		);
	}

	/**
	 * The height of the box a measured fragment will be drawn in.
	 *
	 * A `Range` measures the text; the page draws line boxes. Where the line height is above the glyphs' own —
	 * every paragraph in the product, and in the OpenAPI viewer 25px of line for 17px of text — one is not the
	 * other, and a page whose last lines were booked by their glyphs kept room the sheet does not have: what
	 * came after was drawn past its edge, 21px of it in the export this was found on.
	 *
	 * The count of lines is what survives the difference: the measured rectangle of n plain-text lines is n-1
	 * whole lines plus one box of glyphs. Inline content can be taller than its line, so the result must never
	 * be smaller than the rectangle Range actually measured.
	 */
	private _lineBoxes(textHeight: number): number {
		const lineHeight = this._nodeDimension?.lineHeight;
		if (!lineHeight || !textHeight) return textHeight;

		const lineBoxes = Math.max(1, Math.round(textHeight / lineHeight)) * lineHeight;
		return Math.max(textHeight, lineBoxes);
	}

	private _checkCanUpdate(height: number) {
		const nodeDimension = Paginator.paginationInfo.nodeDimension;
		const dims = this._nodeDimension;
		const newDims = { ...dims, height };
		const canUpdate = nodeDimension.canUpdateAccumulatedHeightDim(newDims, this._parentPaginator.getUsableHeight());
		return canUpdate;
	}

	private _getTotalCharCount(element: HTMLElement): number {
		let count = 0;
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let node: Node | null = walker.nextNode();
		while (node) {
			count += (node as Text).data.length;
			node = walker.nextNode();
		}
		return count;
	}

	/**
	 * Copies a portion of content from sourceElement to targetElement,
	 * from charIndexStart to charIndexEnd (inclusive), preserving element structure.
	 * Uses Range.cloneContents() for accurate DOM cloning.
	 */
	private _setParagraphContent(targetElement: HTMLElement, charIndexStart: number, charIndexEnd: number): void {
		const sourceElement = this._node.cloneNode(true) as HTMLElement;
		const range = document.createRange();
		this._setRangeToCharIndex(range, sourceElement, charIndexStart, charIndexEnd);
		const clonedContent = range.cloneContents();
		targetElement.appendChild(clonedContent);
	}

	/**
	 * Finds the maximum possible endCharIndex for the current page
	 * so that the Range from charIndexStart to endCharIndex does not exceed the page height.
	 */
	private _findEndCharIndexForPage(
		element: HTMLElement,
		charIndexStart: number,
		totalCharCount: number,
	): { endCharIndex: number; height: number } {
		const usableHeight = this._parentPaginator.getUsableHeight();
		const accumulated = Paginator.paginationInfo.accumulatedHeight;

		const dim = this._nodeDimension;
		const collapsedMargin = Math.max(accumulated.marginBottom, dim.marginTop);
		const pageHeightLeft = Math.max(0, usableHeight - accumulated.height - collapsedMargin - dim.marginBottom);

		const range = document.createRange();

		let low = charIndexStart + 1;
		let high = totalCharCount;
		let bestIndex = charIndexStart;
		let bestHeight = 0;

		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			this._setRangeToCharIndex(range, element, charIndexStart, mid);

			const rect = range.getBoundingClientRect();
			const h = this._lineBoxes(rect.height || 0);

			if (!h) {
				low = mid + 1;
				continue;
			}

			if (h <= pageHeightLeft) {
				bestIndex = mid;
				bestHeight = h;
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}

		// If nothing fits (even one character), take the entire remainder
		// to avoid creating empty pages — let there be one "broken" page
		if (bestHeight === 0) {
			const fallbackEnd = totalCharCount;
			this._setRangeToCharIndex(range, element, charIndexStart, fallbackEnd);
			const rect = range.getBoundingClientRect();
			return { endCharIndex: fallbackEnd, height: this._lineBoxes(rect.height || 0) };
		}

		return { endCharIndex: bestIndex, height: bestHeight };
	}

	private _setRangeToCharIndex(
		range: Range,
		element: HTMLElement,
		charIndexStart: number,
		charIndexEnd: number,
	): void {
		let currentIndex = 0;
		let startNode: Text | null = null;
		let startOffset = 0;
		let endNode: Text | null = null;
		let endOffset = 0;

		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let node: Node | null = walker.nextNode();

		while (node) {
			const textNode = node as Text;
			const textLength = textNode.data.length;

			if (!startNode && currentIndex + textLength > charIndexStart) {
				startNode = textNode;
				startOffset = charIndexStart - currentIndex;
			}

			if (currentIndex + textLength >= charIndexEnd) {
				endNode = textNode;
				endOffset = charIndexEnd - currentIndex;
				break;
			}

			currentIndex += textLength;
			node = walker.nextNode();
		}

		if (startNode && endNode) {
			range.setStart(startNode, startOffset);
			range.setEnd(endNode, endOffset);
		}
	}
}

export default ParagraphPaginator;
