/** @jest-environment node */
import { type WorkspaceLayoutItem, WorkspaceView } from "@ext/workspace/WorkspaceConfig";
import { mergeLayoutItems } from "./mergeSections";

const section = (id: string, items: WorkspaceLayoutItem[]): WorkspaceLayoutItem => ({
	type: "section",
	id,
	title: id,
	view: WorkspaceView.section,
	items,
});

describe("mergeLayoutItems", () => {
	test("keeps a hidden catalog at its previous sibling position", () => {
		const previous = section("docs", [
			{ type: "catalog", name: "a" },
			{ type: "catalog", name: "hidden" },
			{ type: "catalog", name: "b" },
		]);
		const next = section("docs", [
			{ type: "catalog", name: "b" },
			{ type: "catalog", name: "a" },
		]);

		expect(mergeLayoutItems([previous], [next], ["a", "b"])[0]).toMatchObject({
			items: [
				{ type: "catalog", name: "b" },
				{ type: "catalog", name: "a" },
				{ type: "catalog", name: "hidden" },
			],
		});
	});

	test("does not restore a visible catalog moved to the root", () => {
		const previous = section("docs", [{ type: "catalog", name: "moved" }]);
		const next = [section("docs", []), { type: "catalog" as const, name: "moved" }];
		expect(mergeLayoutItems([previous], next, ["moved"])).toEqual(next);
	});

	test("keeps a fully hidden section", () => {
		const hidden = section("secret", [{ type: "catalog", name: "private" }]);
		expect(mergeLayoutItems([hidden], [], [])).toEqual([hidden]);
	});
});
