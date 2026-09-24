/**
 * @jest-environment node
 */
import type { Section } from "@core/SitePresenter/SitePresenter";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import Style from "../Cards/model/Style";
import { buildLinkIndex, catalogItem, sectionToFolder } from "./homeLayoutBuilders";

const catalogLink = (name: string): CatalogLink => ({
	name,
	title: name,
	pathname: `/${name}`,
	logo: "",
	style: Style.blue,
	group: "",
	order: 0,
	description: "",
});

describe("sectionToFolder", () => {
	test("keeps the catalog names of the section as folder items", () => {
		const section: Section = {
			title: "Docs",
			href: "/docs",
			catalogLinks: [catalogLink("a"), catalogLink("b")],
		};

		expect(sectionToFolder("docs", section)).toEqual({
			type: "folder",
			id: "docs",
			title: "Docs",
			items: ["a", "b"],
			href: "/docs",
		});
	});

	test("omits icon and description instead of writing them as undefined", () => {
		const folder = sectionToFolder("docs", { title: "Docs", href: "/docs", catalogLinks: [] });

		expect(folder).not.toHaveProperty("icon");
		expect(folder).not.toHaveProperty("description");
		expect(folder.items).toEqual([]);
	});

	test("carries icon and description when the section has them", () => {
		const folder = sectionToFolder("docs", {
			title: "Docs",
			href: "/docs",
			icon: "book",
			description: "All docs",
			catalogLinks: [],
		});

		expect(folder).toMatchObject({ icon: "book", description: "All docs" });
	});

	test("carries descendant layout items which a homepage save cannot edit", () => {
		const folder = sectionToFolder("tools", {
			title: "Tools",
			href: "/tools",
			catalogLinks: [],
			layoutItems: [{ type: "section", id: "deep", title: "Deep", items: [] }],
		});

		expect(folder.children).toEqual([{ type: "section", id: "deep", title: "Deep", items: [] }]);
	});
});

describe("buildLinkIndex", () => {
	test("flattens catalogs of the whole section tree into a name lookup", () => {
		const section: Section = {
			title: "root",
			href: "/",
			catalogLinks: [catalogLink("root-catalog")],
			sections: {
				docs: {
					title: "Docs",
					href: "/docs",
					catalogLinks: [catalogLink("guide")],
					sections: {
						nested: { title: "Nested", href: "/docs/nested", catalogLinks: [catalogLink("deep")] },
					},
				},
			},
		};

		expect(Object.keys(buildLinkIndex(section)).sort()).toEqual(["deep", "guide", "root-catalog"]);
		expect(buildLinkIndex(section).deep.pathname).toBe("/deep");
	});

	test("returns an empty index for a section without catalogs", () => {
		expect(buildLinkIndex({ title: "root", href: "/", catalogLinks: [] })).toEqual({});
	});
});

describe("catalogItem", () => {
	test("wraps a catalog name into a layout item", () => {
		expect(catalogItem("a")).toEqual({ type: "catalog", name: "a" });
	});
});
