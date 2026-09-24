/**
 * @jest-environment node
 */

import { catalogItem } from "./homeLayoutBuilders";
import { type HomeFolder, type HomeSections, UNCATEGORIZED_ID } from "./homeLayoutTypes";
import { addGroup, convertSectionToFolder, deleteGroup, setGroupTitle } from "./sectionMutations";

const folder = (id: string, items: string[], title = "Folder"): HomeFolder => ({ type: "folder", id, title, items });

const uncategorized = (...names: string[]) => ({ id: UNCATEGORIZED_ID, items: names.map(catalogItem) });

const sectionIds = (sections: HomeSections) => sections.map((section) => section.id);

const names = (sections: HomeSections, sectionId: string) =>
	sections
		.find((section) => section.id === sectionId)
		?.items.map((item) => (item.type === "catalog" ? item.name : `[${item.id}]`));

describe("addGroup", () => {
	test("creates an untitled section above the uncategorized one", () => {
		const sections: HomeSections = [{ id: "docs", items: [] }, uncategorized("a")];
		expect(sectionIds(addGroup(sections, "New section"))).toEqual(["docs", "untitled", UNCATEGORIZED_ID]);
	});

	test("adds the first free index when untitled ids are occupied", () => {
		const sections: HomeSections = [
			{ id: "untitled", items: [] },
			{ id: "untitled-2", items: [] },
			{ id: "docs", items: [] },
		];
		expect(sectionIds(addGroup(sections, "New section"))).toEqual(["untitled", "untitled-2", "docs", "untitled-3"]);
	});
});

describe("setGroupTitle", () => {
	test("renames the section id with a transliterated title", () => {
		const sections: HomeSections = [{ id: "docs", title: "Docs", items: [] }];

		expect(setGroupTitle(sections, "docs", "Новые гайды")[0]).toMatchObject({
			id: "novye-gaydy",
			title: "Новые гайды",
		});
	});

	test("adds the first free index when the title slug is occupied", () => {
		const sections: HomeSections = [
			{ id: "docs", title: "Docs", items: [] },
			{ id: "guides", title: "Existing", items: [] },
			{ id: "guides-2", title: "Existing 2", items: [] },
		];

		expect(setGroupTitle(sections, "docs", "Guides")[0]).toMatchObject({ id: "guides-3", title: "Guides" });
	});

	test("keeps the same reference when the title is unchanged or the section is missing", () => {
		const sections: HomeSections = [{ id: "docs", title: "Docs", items: [] }];

		expect(setGroupTitle(sections, "docs", "Docs")).toBe(sections);
		expect(setGroupTitle(sections, "missing", "Guides")).toBe(sections);
	});

	test("re-derives the id from the new title", () => {
		const sections: HomeSections = [{ id: "docs", title: "Docs", items: [] }];

		expect(setGroupTitle(sections, "docs", "Guides")[0].id).toBe("guides");
	});

	test("dedupes the new id against sibling section ids", () => {
		const sections: HomeSections = [
			{ id: "docs", title: "Docs", items: [] },
			{ id: "guides", title: "Guides", items: [] },
		];

		expect(setGroupTitle(sections, "docs", "Guides")[0].id).toBe("guides-2");
	});
});

describe("deleteGroup", () => {
	test("moves the items of the removed section into the uncategorized one", () => {
		const sections: HomeSections = [{ id: "docs", items: [catalogItem("a")] }, uncategorized("b")];

		const next = deleteGroup(sections, "docs");

		expect(sectionIds(next)).toEqual([UNCATEGORIZED_ID]);
		expect(names(next, UNCATEGORIZED_ID)).toEqual(["b", "a"]);
	});

	test("creates the uncategorized section when it does not exist yet", () => {
		const sections: HomeSections = [{ id: "docs", items: [catalogItem("a")] }];

		const next = deleteGroup(sections, "docs");

		expect(sectionIds(next)).toEqual([UNCATEGORIZED_ID]);
		expect(names(next, UNCATEGORIZED_ID)).toEqual(["a"]);
	});
});

describe("convertSectionToFolder", () => {
	test("packs the catalogs of the section into a folder named after it", () => {
		const sections: HomeSections = [
			{ id: "docs", title: "Docs", items: [catalogItem("a"), catalogItem("b")] },
			uncategorized(),
		];

		const next = convertSectionToFolder(sections, "docs");

		expect(sectionIds(next)).toEqual([UNCATEGORIZED_ID]);
		const [created] = next[0].items;
		expect(created).toMatchObject({ type: "folder", title: "Docs", items: ["a", "b"] });
	});

	test("moves nested folders out as they are, without wrapping them", () => {
		const sections: HomeSections = [
			{ id: "docs", title: "Docs", items: [folder("f", ["x"]), catalogItem("a")] },
			uncategorized(),
		];

		const next = convertSectionToFolder(sections, "docs");

		expect(next[0].items).toHaveLength(2);
		expect(next[0].items[0]).toMatchObject({ type: "folder", title: "Docs", items: ["a"] });
		expect(next[0].items[1]).toMatchObject({ type: "folder", id: "f", items: ["x"] });
	});

	test("keeps a section with only nested folders unchanged", () => {
		const sections: HomeSections = [{ id: "docs", title: "Docs", items: [folder("f", ["x"])] }, uncategorized()];

		const next = convertSectionToFolder(sections, "docs");

		expect(next).toBe(sections);
	});

	test("dedupes the new folder id against folders moved out of the section", () => {
		const sections: HomeSections = [
			{ id: "docs-section", title: "Docs", items: [catalogItem("a"), folder("docs", ["x"])] },
			uncategorized(),
		];

		const next = convertSectionToFolder(sections, "docs-section");

		expect(next[0].items).toMatchObject([
			{ type: "folder", id: "docs-2", items: ["a"] },
			{ type: "folder", id: "docs", items: ["x"] },
		]);
	});

	test("keeps the same reference for a missing section", () => {
		const sections: HomeSections = [uncategorized("a")];

		expect(convertSectionToFolder(sections, "missing")).toBe(sections);
	});
});
