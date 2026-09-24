/**
 * @jest-environment node
 */

/**
 * Multi-step scenarios: single mutations are covered next to each module, this suite checks that they compose without
 * losing catalogs — every operation here only ever moves a catalog somewhere else, never drops or duplicates one.
 */

import { convertFolderToSection, deleteFolder, removeFromFolder } from "./folderMutations";
import { catalogItem } from "./homeLayoutBuilders";
import { type HomeFolder, type HomeSections, isHomeFolder, UNCATEGORIZED_ID } from "./homeLayoutTypes";
import { mergeItems } from "./mergeItems";
import { convertSectionToFolder, deleteGroup } from "./sectionMutations";

/** Every catalog reachable in the layout, folders included, in a stable order. */
const catalogNames = (sections: HomeSections) =>
	sections
		.flatMap((section) => section.items.flatMap((item) => (item.type === "catalog" ? [item.name] : item.items)))
		.sort();

const folderIdIn = (sections: HomeSections, sectionId: string) =>
	sections.find((section) => section.id === sectionId)?.items.find(isHomeFolder)?.id;

const uncategorized = (sections: HomeSections) => sections.find((section) => section.id === UNCATEGORIZED_ID);

describe("section becomes a folder and back", () => {
	const start = (): HomeSections => [
		{ id: "docs", title: "Docs", items: [catalogItem("a"), catalogItem("b")] },
		{ id: UNCATEGORIZED_ID, items: [] },
	];

	test("the round trip keeps every catalog and the section title", () => {
		const sections = start();

		const asFolder = convertSectionToFolder(sections, "docs");
		const folderId = folderIdIn(asFolder, UNCATEGORIZED_ID);
		const backToSection = convertFolderToSection(asFolder, folderId as string);

		expect(catalogNames(backToSection)).toEqual(["a", "b"]);
		expect(backToSection.find((section) => section.title === "Docs")).toBeDefined();
	});

	test("the section that comes back reclaims the old id when the title is unchanged and the id is free", () => {
		const asFolder = convertSectionToFolder(start(), "docs");
		const backToSection = convertFolderToSection(asFolder, folderIdIn(asFolder, UNCATEGORIZED_ID) as string);

		// the id is a slug of the title, deduped against current siblings only — "docs" is up for grabs again
		// since the original section is gone by this point, so anything that pinned the layout to "docs" still resolves
		expect(backToSection.some((section) => section.id === "docs")).toBe(true);
	});
});

describe("deleting a section that holds a folder", () => {
	const withFolder = (): HomeSections => [
		{ id: "docs", items: [catalogItem("loose"), { type: "folder", id: "f", title: "F", items: ["x", "y"] }] },
		{ id: UNCATEGORIZED_ID, items: [] },
	];

	test("moves the folder across whole, instead of unpacking it", () => {
		const next = deleteGroup(withFolder(), "docs");

		const moved = uncategorized(next)?.items;
		expect(moved?.map((item) => item.type)).toEqual(["catalog", "folder"]);
		expect((moved?.[1] as HomeFolder)?.items).toEqual(["x", "y"]);
	});

	test("keeps every catalog, whether it sat in the folder or beside it", () => {
		const sections = withFolder();

		expect(catalogNames(deleteGroup(sections, "docs"))).toEqual(catalogNames(sections));
	});
});

describe("merging and unpacking are inverse", () => {
	const twoCards = (): HomeSections => [{ id: "main", items: [catalogItem("a"), catalogItem("b")] }];

	test("unpacking a freshly merged folder restores both cards", () => {
		const merged = mergeItems(twoCards(), "a", "catalog", "b", "b & a") as HomeSections;
		const folderId = folderIdIn(merged, "main") as string;

		const unpacked = deleteFolder(merged, folderId);

		expect(unpacked[0].items.map((item) => item.type === "catalog" && item.name)).toEqual(["b", "a"]);
	});

	test("merging never loses a catalog, even across sections", () => {
		const sections: HomeSections = [
			{ id: "left", items: [catalogItem("a")] },
			{ id: "right", items: [catalogItem("b")] },
		];

		expect(catalogNames(mergeItems(sections, "a", "catalog", "b", "b & a") as HomeSections)).toEqual(["a", "b"]);
	});

	test("a card dropped onto itself changes nothing", () => {
		expect(mergeItems(twoCards(), "a", "catalog", "a", "a & a")).toBeNull();
	});
});

describe("emptying a folder catalog by catalog", () => {
	const folderOfTwo = (): HomeSections => [
		{ id: "docs", items: [{ type: "folder", id: "f", title: "F", items: ["x", "y"] }] },
		{ id: UNCATEGORIZED_ID, items: [] },
	];

	test("the folder survives while it still holds something", () => {
		const next = removeFromFolder(folderOfTwo(), "docs", "f", "x");

		expect(next.find((section) => section.id === "docs")?.items).toHaveLength(1);
		expect(catalogNames(next)).toEqual(["x", "y"]);
	});

	test("removing the last one drops the folder but keeps both catalogs", () => {
		const afterFirst = removeFromFolder(folderOfTwo(), "docs", "f", "x");

		const afterSecond = removeFromFolder(afterFirst, "docs", "f", "y");

		expect(afterSecond.find((section) => section.id === "docs")?.items).toEqual([]);
		expect(catalogNames(afterSecond)).toEqual(["x", "y"]);
	});

	test("a folder living in the uncategorized section empties into that same section", () => {
		const sections: HomeSections = [
			{ id: UNCATEGORIZED_ID, items: [{ type: "folder", id: "f", title: "F", items: ["x"] }] },
		];

		const next = removeFromFolder(sections, UNCATEGORIZED_ID, "f", "x");

		expect(next).toHaveLength(1);
		expect(uncategorized(next)?.items).toEqual([catalogItem("x")]);
	});
});

describe("uncategorized section as a mutation target", () => {
	test("deleting it re-creates it with the same catalogs, so nothing is lost", () => {
		const sections: HomeSections = [{ id: UNCATEGORIZED_ID, items: [catalogItem("a"), catalogItem("b")] }];

		const next = deleteGroup(sections, UNCATEGORIZED_ID);

		// a fresh array, but the layout a user would see is identical — the store compares by content and skips it
		expect(next).not.toBe(sections);
		expect(next).toEqual(sections);
	});
});
