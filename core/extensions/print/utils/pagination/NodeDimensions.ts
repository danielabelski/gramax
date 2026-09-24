import Paginator from "@ext/print/utils/pagination/Paginator";
import assert from "assert";

export interface NodeDimensionsData {
	height: number;
	marginTop: number;
	marginBottom: number;
	paddingH: number;
	/** Top plus bottom border. Only a wrapper cloned as page chrome needs it — a node's own height has it in. */
	borderH?: number;
	lineHeight?: number;
	breakBefore?: string;
}

export interface AccumulatedHeight {
	height: number;
	marginBottom: number;
}

export class NodeDimensions {
	constructor(private _dimensions: WeakMap<HTMLElement, NodeDimensionsData>) {}

	static async init(source: HTMLElement, yieldTick: () => Promise<void>, throwIfAborted?: () => void) {
		const nodeDimensions = new WeakMap<HTMLElement, NodeDimensionsData>();
		await NodeDimensions._fill(nodeDimensions, source.querySelectorAll("*"), yieldTick, throwIfAborted);

		return new NodeDimensions(nodeDimensions);
	}

	/**
	 * Measures a subtree again, after something has changed the size of what is in it.
	 *
	 * Heights are taken once, before pagination starts, which is fine for a document nothing rewrites while
	 * it is being dealt out. An OpenAPI block is the exception: a description table too wide for the page is
	 * scaled to fit right before the block is split, and every height inside it is then wrong.
	 */
	async remeasure(root: HTMLElement, yieldTick: () => Promise<void>, throwIfAborted?: () => void) {
		const zooms = new WeakMap<Element, number>();
		this._dimensions.set(root, NodeDimensions._measure(root, zooms));
		await NodeDimensions._fill(this._dimensions, root.querySelectorAll("*"), yieldTick, throwIfAborted, zooms);
	}

	get(node: HTMLElement) {
		return this._dimensions.get(node);
	}

	private static async _fill(
		into: WeakMap<HTMLElement, NodeDimensionsData>,
		nodes: NodeListOf<Element>,
		yieldTick: () => Promise<void>,
		throwIfAborted?: () => void,
		zooms: WeakMap<Element, number> = new WeakMap(),
	) {
		const allNodes = Array.from(nodes);
		for (let i = 0; i < allNodes.length; i++) {
			throwIfAborted?.();

			into.set(allNodes[i] as HTMLElement, NodeDimensions._measure(allNodes[i] as HTMLElement, zooms));

			if ((i + 1) % 200 === 0) {
				await yieldTick();
				throwIfAborted?.();
			}
		}
	}

	/**
	 * How much of a page one CSS pixel inside this node is worth.
	 *
	 * Read off the ancestors rather than from `currentCSSZoom`, which gives the same number but only in
	 * browsers new enough to have it — WebKit added it in late 2025, and Gramax runs in WebKit on the desktop.
	 * Each element's own `zoom` is in the computed style everywhere, and the product down the chain is the
	 * accumulated factor. Memoised: the tree is walked in document order, so an ancestor is normally already
	 * known by the time its children are measured.
	 */
	private static _zoomOf(node: Element | null, zooms: WeakMap<Element, number>, own?: string): number {
		if (!node) return 1;

		const cached = zooms.get(node);
		if (cached !== undefined && own === undefined) return cached;

		const factor = parseFloat(own ?? getComputedStyle(node).zoom) || 1;
		const value = NodeDimensions._zoomOf(node.parentElement, zooms) * factor;
		zooms.set(node, value);
		return value;
	}

	/**
	 * One node's contribution to the height of a page.
	 *
	 * Everything here is scaled by the accumulated `zoom` of the node's ancestors. Inside a zoomed subtree the
	 * layout metrics — `offsetHeight` and every length in the computed style — are reported in that subtree's
	 * own pixels, while the page is measured in the page's: a table scaled to 0.43 reports the height it would
	 * have had unscaled, and a paginator believed it would break the page in three where one was enough.
	 * `getBoundingClientRect` is already in page pixels, which is why the fallback is not scaled.
	 */
	private static _measure(node: HTMLElement, zooms: WeakMap<Element, number> = new WeakMap()): NodeDimensionsData {
		const computedStyle = getComputedStyle(node);
		const zoom = NodeDimensions._zoomOf(node, zooms, computedStyle.zoom);
		const px = (value: string) => (parseFloat(value) || 0) * zoom;

		return {
			height: NodeDimensions._layoutHeight(node, zoom),
			marginTop: px(computedStyle.marginTop),
			marginBottom: px(computedStyle.marginBottom),
			paddingH: px(computedStyle.paddingTop) + px(computedStyle.paddingBottom),
			borderH: px(computedStyle.borderTopWidth) + px(computedStyle.borderBottomWidth),
			lineHeight: (NodeDimensions._getLineHeightInPixels(computedStyle) || 0) * zoom,
			breakBefore: computedStyle.breakBefore,
		};
	}

	/**
	 * The height a node takes in the flow, in page pixels and to the fraction.
	 *
	 * `offsetHeight` is the laid-out height rounded to a whole pixel, and the rounding adds up: a page of table
	 * rows 102.36px tall, booked at 102 each, was drawn 3px past its budget by the ninth. The bounding rectangle
	 * keeps the fraction and is in page pixels already, but it is the painted box, which a transform can move
	 * off the laid-out one. Where the two agree to within the pixel the rounding takes, they are the same box.
	 */
	private static _layoutHeight(node: HTMLElement, zoom: number): number {
		const painted = node.getBoundingClientRect().height || 0;
		if (!node.offsetHeight) return painted;

		const rounded = node.offsetHeight * zoom;
		return Math.abs(painted - rounded) <= zoom ? painted : rounded;
	}

	canUpdateAccumulatedHeight(node: HTMLElement, height: number): boolean {
		const dims = this.get(node);
		if (!dims) return true;
		return this.canUpdateAccumulatedHeightDim(dims, height);
	}

	canUpdateAccumulatedHeightDim(nodeDimensionsData: NodeDimensionsData, height: number): boolean {
		const accumulatedHeight = Paginator.paginationInfo.accumulatedHeight;
		const collapsedMargin = Math.max(accumulatedHeight.marginBottom, nodeDimensionsData.marginTop);
		const newHeight =
			accumulatedHeight.height + collapsedMargin + nodeDimensionsData.height + nodeDimensionsData.marginBottom;

		return newHeight <= height;
	}

	updateAccumulatedHeightNode(
		node: HTMLElement,
		accumulatedHeight: AccumulatedHeight = NodeDimensions.createInitial(),
	) {
		const dims = this.get(node);
		if (!dims) return;

		return this.updateAccumulatedHeightDim(dims, accumulatedHeight);
	}

	updateAccumulatedHeightDim(
		dimension: NodeDimensionsData,
		accumulatedHeight: AccumulatedHeight = NodeDimensions.createInitial(),
	) {
		const collapsedMargin = Math.max(accumulatedHeight.marginBottom, dimension.marginTop);
		const newHeight =
			accumulatedHeight.height +
			collapsedMargin +
			dimension.height -
			accumulatedHeight.marginBottom +
			dimension.marginBottom;
		return {
			height: newHeight,
			marginBottom: dimension.marginBottom,
		};
	}

	static createInitial(): AccumulatedHeight {
		return { height: 0, marginBottom: 0 };
	}

	private static _getLineHeightInPixels(computedStyle: CSSStyleDeclaration): number {
		const lineHeight = computedStyle.lineHeight;

		if (lineHeight === "normal") return parseFloat(computedStyle.fontSize) * 1.2;
		return parseFloat(lineHeight);
	}

	static combineDimensions(
		parentDim: NodeDimensionsData,
		childDim: NodeDimensionsData,
	): NodeDimensionsData | undefined {
		assert(parentDim && childDim, "Both parentDim and childDim are required");

		return {
			height: parentDim.height || childDim.height,
			lineHeight: childDim.lineHeight || parentDim.lineHeight,
			marginTop: parentDim.marginTop + childDim.marginTop,
			marginBottom: parentDim.marginBottom + childDim.marginBottom,
			paddingH: parentDim.paddingH + childDim.paddingH,
		};
	}

	static concatDimensions(
		firstDim: NodeDimensionsData,
		secondDim: NodeDimensionsData,
	): NodeDimensionsData | undefined {
		assert(firstDim && secondDim, "Both parentDim and childDim are required");

		return {
			height: firstDim.height + secondDim.height,
			marginTop: firstDim.marginTop,
			marginBottom: secondDim.marginBottom,
			paddingH: firstDim.paddingH + secondDim.paddingH + Math.max(firstDim.marginBottom, secondDim.marginTop),
		};
	}
}
