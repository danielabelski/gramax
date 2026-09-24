/**
 * @jest-environment node
 */

import { catalogItem } from "./homeLayoutBuilders";
import type { HomeFolder, HomeSections } from "./homeLayoutTypes";
import { mergeItems } from "./mergeItems";

const NEW_FOLDER_TITLE = "Target & Active";

const oneSection = (...names: string[]): HomeSections => [{ id: "main", items: names.map(catalogItem) }];

const firstItem = (sections: HomeSections | null) => sections?.[0].items[0] as HomeFolder;

describe("mergeItems", () => {
	test("wraps both catalogs into a folder under the given title, target first", () => {
		const merged = mergeItems(oneSection("first", "second"), "first", "catalog", "second", NEW_FOLDER_TITLE);

		expect(merged?.[0].items).toHaveLength(1);
		expect(firstItem(merged)).toMatchObject({
			type: "folder",
			title: NEW_FOLDER_TITLE,
			items: ["second", "first"],
		});
	});

	test("creates the folder without href, because it does not exist on the backend yet", () => {
		const merged = mergeItems(oneSection("first", "second"), "first", "catalog", "second", NEW_FOLDER_TITLE);

		expect(firstItem(merged).href).toBeUndefined();
	});

	test("joins an existing folder instead of nesting a new one, keeping its own title", () => {
		const sections: HomeSections = [
			{ id: "main", items: [{ type: "folder", id: "f", title: "Docs", items: ["x"] }, catalogItem("a")] },
		];

		const merged = mergeItems(sections, "a", "folder", "f", NEW_FOLDER_TITLE);

		expect(merged?.[0].items).toHaveLength(1);
		expect(firstItem(merged)).toMatchObject({ id: "f", title: "Docs", items: ["x", "a"] });
	});

	test("never lets the same catalog appear twice in the folder", () => {
		const sections: HomeSections = [
			{ id: "main", items: [{ type: "folder", id: "f", title: "Docs", items: ["a"] }, catalogItem("a")] },
		];

		expect(firstItem(mergeItems(sections, "a", "folder", "f", NEW_FOLDER_TITLE)).items).toEqual(["a"]);
	});

	test("moves the catalog across sections, leaving the source section without it", () => {
		const sections: HomeSections = [
			{ id: "left", items: [catalogItem("a")] },
			{ id: "right", items: [catalogItem("b")] },
		];

		const merged = mergeItems(sections, "a", "catalog", "b", NEW_FOLDER_TITLE);

		expect(merged?.[0].items).toEqual([]);
		expect(merged?.[1].items).toHaveLength(1);
		expect(merged?.[1].items[0]).toMatchObject({ type: "folder", items: ["b", "a"] });
	});

	test("returns null when either side of the merge is missing", () => {
		expect(mergeItems(oneSection("a"), "missing", "catalog", "a", NEW_FOLDER_TITLE)).toBeNull();
		expect(mergeItems(oneSection("a"), "a", "catalog", "missing", NEW_FOLDER_TITLE)).toBeNull();
	});

	test("returns null when the dragged item is a folder rather than a catalog", () => {
		const sections: HomeSections = [
			{ id: "main", items: [{ type: "folder", id: "f", title: "Docs", items: ["x"] }, catalogItem("a")] },
		];

		expect(mergeItems(sections, "f", "catalog", "a", NEW_FOLDER_TITLE)).toBeNull();
	});
});
