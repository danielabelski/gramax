import type { TreeItem } from "../types";
import { flattenTreeItems } from "./flattenTreeItems";

describe("flattenTreeItems", () => {
	it("flattens nested items in pre-order and records their depth", () => {
		const grandchild: TreeItem = { id: "grandchild" };
		const child: TreeItem = { id: "child", children: [grandchild] };
		const sibling: TreeItem = { id: "sibling" };
		const root: TreeItem = { id: "root", children: [child, sibling] };

		expect(flattenTreeItems([root])).toEqual([
			{ item: root, depth: 0 },
			{ item: child, depth: 1 },
			{ item: grandchild, depth: 2 },
			{ item: sibling, depth: 1 },
		]);
	});

	it("applies the supplied initial depth", () => {
		const item: TreeItem = { id: "item" };

		expect(flattenTreeItems([item], 3)).toEqual([{ item, depth: 3 }]);
	});
});
