/**
 * @jest-environment jsdom
 *
 * How tall the paginator believes a node is.
 *
 * jsdom lays nothing out, so both of the browser's answers are stated per node: `offsetHeight`, which is the
 * laid-out height rounded to a whole pixel, and the bounding rectangle, which keeps the fraction and is the
 * painted box.
 */

import { NodeDimensions } from "@ext/print/utils/pagination/NodeDimensions";

const measured = async (offsetHeight: number, paintedHeight: number) => {
	const source = document.createElement("div");
	const node = document.createElement("div");
	Object.defineProperty(node, "offsetHeight", { value: offsetHeight, configurable: true });
	node.getBoundingClientRect = () => ({ height: paintedHeight }) as DOMRect;
	source.appendChild(node);

	const dimensions = await NodeDimensions.init(source, () => Promise.resolve());
	return dimensions.get(node).height;
};

describe("A node is booked at the height it is laid out at", () => {
	// A page of table rows 102.36px tall, booked at 102 each, was drawn 3px past its budget by the ninth row.
	test("to the fraction of a pixel", async () => {
		expect(await measured(102, 102.36)).toBeCloseTo(102.36, 5);
	});

	// A transform moves the painted box and leaves the layout where it was: a row drawn twice its height still
	// pushes what follows by its own.
	test("and not at the size a transform paints it at", async () => {
		expect(await measured(102, 204)).toBe(102);
	});

	test("even when the layout reports no height of its own", async () => {
		expect(await measured(0, 17.5)).toBe(17.5);
	});
});
