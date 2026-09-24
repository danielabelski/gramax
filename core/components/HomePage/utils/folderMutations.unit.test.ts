/**
 * @jest-environment node
 */

import {
	convertFolderToSection,
	deleteFolder,
	removeFromFolder,
	renameFolder,
	reorderFolderItems,
} from "./folderMutations";
import { catalogItem } from "./homeLayoutBuilders";
import { type HomeFolder, type HomeSections, isHomeFolder, NEW_SECTION_KEY, UNCATEGORIZED_ID } from "./homeLayoutTypes";

const folder = (id: string, items: string[], title = "Folder"): HomeFolder => ({ type: "folder", id, title, items });

const uncategorized = (...names: string[]) => ({ id: UNCATEGORIZED_ID, items: names.map(catalogItem) });

const names = (sections: HomeSections, sectionId: string) =>
	sections
		.find((section) => section.id === sectionId)
		?.items.map((item) => (item.type === "catalog" ? item.name : `[${item.id}]`));

const folderIn = (sections: HomeSections, sectionId: string, folderId: string) =>
	sections
		.find((section) => section.id === sectionId)
		?.items.find((item) => isHomeFolder(item) && item.id === folderId) as HomeFolder | undefined;

describe("convertFolderToSection", () => {
	test("turns the folder into a section placed above the uncategorized one", () => {
		const sections: HomeSections = [{ id: UNCATEGORIZED_ID, items: [folder("f", ["a", "b"], "Guides")] }];

		const next = convertFolderToSection(sections, "f");

		expect(next).toHaveLength(2);
		expect(next[0].title).toBe("Guides");
		expect(names(next, next[0].id)).toEqual(["a", "b"]);
		expect(next[1].id).toBe(UNCATEGORIZED_ID);
		expect(next[1].items).toEqual([]);
	});

	test("keeps the same reference for a missing folder", () => {
		const sections: HomeSections = [uncategorized("a")];

		expect(convertFolderToSection(sections, "missing")).toBe(sections);
	});

	test("derives the id from the folder title", () => {
		const sections: HomeSections = [{ id: UNCATEGORIZED_ID, items: [folder("f", ["a"], "Guides")] }];

		const next = convertFolderToSection(sections, "f");

		expect(next[0].id).toBe("guides");
	});

	test("dedupes the id against sibling section ids", () => {
		const sections: HomeSections = [
			{ id: "guides", items: [] },
			{ id: UNCATEGORIZED_ID, items: [folder("f", ["a"], "Guides")] },
		];

		const next = convertFolderToSection(sections, "f");

		expect(next.some((section) => section.id === "guides-2")).toBe(true);
	});

	test("falls back to the default key when the title has no transliterable characters", () => {
		const sections: HomeSections = [{ id: UNCATEGORIZED_ID, items: [folder("f", ["a"], "🚀")] }];

		const next = convertFolderToSection(sections, "f");

		expect(next[0].id).toBe(NEW_SECTION_KEY);
	});
});

describe("deleteFolder", () => {
	test("unpacks the folder in place, keeping the surrounding order", () => {
		const sections: HomeSections = [
			{ id: "docs", items: [catalogItem("first"), folder("f", ["x", "y"]), catalogItem("last")] },
		];

		const next = deleteFolder(sections, "f");

		expect(names(next, "docs")).toEqual(["first", "x", "y", "last"]);
	});

	test("keeps the same reference for a missing folder", () => {
		const sections: HomeSections = [{ id: "docs", items: [catalogItem("a")] }];

		expect(deleteFolder(sections, "missing")).toBe(sections);
	});
});

describe("renameFolder", () => {
	test("renames the folder", () => {
		const sections: HomeSections = [{ id: "docs", items: [folder("f", ["x"], "Old")] }];

		expect(folderIn(renameFolder(sections, "f", "New"), "docs", "new")?.title).toBe("New");
	});

	test("re-derives the id from the new title", () => {
		const sections: HomeSections = [{ id: "docs", items: [folder("f", ["x"], "Old")] }];

		expect(folderIn(renameFolder(sections, "f", "New"), "docs", "f")).toBeUndefined();
	});

	test("dedupes the new id against every id in the layout, not just its own section", () => {
		const sections: HomeSections = [
			{ id: "new", items: [] },
			{ id: "docs", items: [folder("f", ["x"], "Old")] },
		];

		expect(folderIn(renameFolder(sections, "f", "New"), "docs", "new-2")?.title).toBe("New");
	});

	test("keeps the same reference when the title is unchanged or the folder is missing", () => {
		const sections: HomeSections = [{ id: "docs", items: [folder("f", ["x"], "Old")] }];

		expect(renameFolder(sections, "f", "Old")).toBe(sections);
		expect(renameFolder(sections, "missing", "New")).toBe(sections);
	});
});

describe("removeFromFolder", () => {
	test("moves the catalog out of the folder and into the uncategorized section", () => {
		const sections: HomeSections = [{ id: "docs", items: [folder("f", ["x", "y"])] }, uncategorized()];

		const next = removeFromFolder(sections, "docs", "f", "x");

		expect(folderIn(next, "docs", "f")?.items).toEqual(["y"]);
		expect(names(next, UNCATEGORIZED_ID)).toEqual(["x"]);
	});

	test("drops the folder once its last catalog leaves", () => {
		const sections: HomeSections = [{ id: "docs", items: [folder("f", ["x"])] }, uncategorized()];

		const next = removeFromFolder(sections, "docs", "f", "x");

		expect(names(next, "docs")).toEqual([]);
		expect(names(next, UNCATEGORIZED_ID)).toEqual(["x"]);
	});

	test("edits the folder in the named section, not a same-named folder elsewhere", () => {
		const sections: HomeSections = [
			{ id: "marketing", items: [folder("archive", ["m"])] },
			{ id: "sales", items: [folder("archive", ["s"])] },
			uncategorized(),
		];

		const next = removeFromFolder(sections, "sales", "archive", "s");

		expect(folderIn(next, "marketing", "archive")?.items).toEqual(["m"]);
		expect(folderIn(next, "sales", "archive")).toBeUndefined();
		expect(names(next, UNCATEGORIZED_ID)).toEqual(["s"]);
	});
});

describe("reorderFolderItems", () => {
	test("applies the new order", () => {
		const sections: HomeSections = [{ id: "docs", items: [folder("f", ["x", "y"])] }];

		expect(folderIn(reorderFolderItems(sections, "docs", "f", ["y", "x"]), "docs", "f")?.items).toEqual(["y", "x"]);
	});

	test("keeps the same reference when the order already matches", () => {
		const sections: HomeSections = [{ id: "docs", items: [folder("f", ["x", "y"])] }];

		expect(reorderFolderItems(sections, "docs", "f", ["x", "y"])).toBe(sections);
	});

	test("reorders the folder in the named section, not a same-named folder elsewhere", () => {
		const sections: HomeSections = [
			{ id: "marketing", items: [folder("archive", ["m1", "m2"])] },
			{ id: "sales", items: [folder("archive", ["s1", "s2"])] },
		];

		const next = reorderFolderItems(sections, "sales", "archive", ["s2", "s1"]);

		expect(folderIn(next, "marketing", "archive")?.items).toEqual(["m1", "m2"]);
		expect(folderIn(next, "sales", "archive")?.items).toEqual(["s2", "s1"]);
	});
});
