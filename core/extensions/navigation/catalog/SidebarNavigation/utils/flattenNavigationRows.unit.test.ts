import { flattenNavigationRows } from "./flattenNavigationRows";

describe("flattenNavigationRows", () => {
	const childrenMap = { a: ["b", "d"], b: ["c"], c: [], d: [], e: [] };

	it("keeps only expanded descendants in navigation order with their depth", () => {
		expect(flattenNavigationRows(["a", "e"], childrenMap, new Set(["a"]))).toEqual([
			{ id: "a", level: 1, groupId: "a" },
			{ id: "b", level: 2, groupId: "a" },
			{ id: "d", level: 2, groupId: "a" },
			{ id: "e", level: 1, groupId: "e" },
		]);
	});

	it("hides descendants even when a closed ancestor has expanded children", () => {
		expect(flattenNavigationRows(["a", "e"], childrenMap, new Set(["b"])).map((row) => row.id)).toEqual(["a", "e"]);
	});

	it("includes every level of an expanded branch", () => {
		expect(flattenNavigationRows(["a"], childrenMap, new Set(["a", "b"]))).toEqual([
			{ id: "a", level: 1, groupId: "a" },
			{ id: "b", level: 2, groupId: "a" },
			{ id: "c", level: 3, groupId: "a" },
			{ id: "d", level: 2, groupId: "a" },
		]);
	});

	it("handles an empty catalog", () => {
		expect(flattenNavigationRows([], {}, new Set())).toEqual([]);
	});
});
