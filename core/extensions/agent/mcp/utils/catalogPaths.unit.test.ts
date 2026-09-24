import Path from "@core/FileProvider/Path/Path";
import { CatalogItemLookup } from "./catalogPaths";

describe("CatalogItemLookup", () => {
	test("normalizePath trims, strips leading slashes and normalizes separators", () => {
		expect(CatalogItemLookup.normalizePath("  /docs\\section\\a.md  ")).toBe("docs/section/a.md");
		expect(CatalogItemLookup.normalizePath("")).toBe("");
		expect(CatalogItemLookup.normalizePath("///\\\\")).toBe("");
		expect(CatalogItemLookup.normalizePath("docs//section///a.md")).toBe("docs//section///a.md");
	});

	test("constructor normalizes catalogName and gramax itemPath", () => {
		const lookup = new CatalogItemLookup(" /docs ", " \\section\\a.md ", "Title");
		expect(lookup.catalogName).toBe("docs");
		expect(lookup.itemPath).toBe("section/a.md");
		expect(lookup.title).toBe("Title");
		expect(lookup.asPath()).toEqual(new Path("docs/section/a.md"));
	});

	test("fromCatalogItem + asAgentJSON maps article and category paths", () => {
		const articleCatalog = {
			name: "docs",
			getRepositoryRelativePath: () => new Path("section/a.md"),
		} as never;
		const article = {
			ref: { path: new Path("docs/section/a.md") },
			getTitle: () => "Article A",
		} as never;

		expect(CatalogItemLookup.fromCatalogItem(articleCatalog, article).asAgentJSON()).toEqual({
			catalogName: "docs",
			itemPath: "section/a",
			title: "Article A",
		});

		const categoryCatalog = {
			name: "docs",
			getRepositoryRelativePath: () => new Path("guides/_index.md"),
		} as never;
		const category = {
			ref: { path: new Path("docs/guides/_index.md") },
			getTitle: () => "Guides",
		} as never;

		expect(CatalogItemLookup.fromCatalogItem(categoryCatalog, category).asAgentJSON()).toEqual({
			catalogName: "docs",
			itemPath: "guides/",
			title: "Guides",
		});
	});

	test("findItem resolves agent and gramax paths to the same item", () => {
		const findItemByItemPath = jest.fn((path: Path) => {
			if (path.value === "docs/guides/setup.md") return { ref: { path } } as never;
			if (path.value === "docs/guides/_index.md") return { ref: { path } } as never;
			return null;
		});
		const catalog = { name: "docs", findItemByItemPath } as never;

		expect(CatalogItemLookup.findItem(catalog, "guides/setup")).toEqual({
			ref: { path: new Path("docs/guides/setup.md") },
		});
		expect(CatalogItemLookup.findItem(catalog, "guides/setup.md")).toEqual({
			ref: { path: new Path("docs/guides/setup.md") },
		});
		expect(findItemByItemPath).toHaveBeenCalledWith(new Path("docs/guides/setup.md"));

		expect(CatalogItemLookup.findItem(catalog, "guides/")).toEqual({
			ref: { path: new Path("docs/guides/_index.md") },
		});
		expect(CatalogItemLookup.findItem(catalog, "guides/_index.md")).toEqual({
			ref: { path: new Path("docs/guides/_index.md") },
		});
		expect(findItemByItemPath).toHaveBeenCalledWith(new Path("docs/guides/_index.md"));
	});

	test("parseItemPath splits parent, fileName and type", () => {
		expect(CatalogItemLookup.parseItemPath("guides/setup")).toEqual({
			isCategory: false,
			fileName: "setup",
			parentAgentItemPath: "guides/",
		});
		expect(CatalogItemLookup.parseItemPath("guides/setup/")).toEqual({
			isCategory: true,
			fileName: "setup",
			parentAgentItemPath: "guides/",
		});
		expect(CatalogItemLookup.parseItemPath("setup")).toEqual({
			isCategory: false,
			fileName: "setup",
			parentAgentItemPath: "",
		});
	});

	test("parseItemPath maps .md and _index.md to agent paths", () => {
		expect(CatalogItemLookup.parseItemPath("guides/setup.md")).toEqual({
			isCategory: false,
			fileName: "setup",
			parentAgentItemPath: "guides/",
		});
		expect(CatalogItemLookup.parseItemPath("guides/setup/_index.md")).toEqual({
			isCategory: true,
			fileName: "setup",
			parentAgentItemPath: "guides/",
		});
	});

	test("parseItemPath rejects empty path", () => {
		expect(() => CatalogItemLookup.parseItemPath("")).toThrow("itemPath must not be empty");
		expect(() => CatalogItemLookup.parseItemPath("///")).toThrow("itemPath must not be empty");
	});

	test("resolve returns skill article and virtual lookup", async () => {
		const skillArticle = {
			getTitle: () => "writing-mr",
		};
		const findItemByItemPath = jest.fn();
		const catalog = {
			findItemByItemPath,
			customProviders: {
				agentResourcesProvider: {
					getSkillArticleByItemPath: jest.fn().mockResolvedValue(skillArticle),
				},
			},
		} as never;

		const resolved = await CatalogItemLookup.resolve(catalog, "docs", "@skills/writing-mr");

		expect(resolved?.item).toBe(skillArticle);
		expect(resolved?.lookup).toMatchObject({
			catalogName: "docs",
			itemPath: "@skills/writing-mr",
			title: "writing-mr",
		});
		expect(resolved?.lookup.asAgentJSON()).toEqual({
			catalogName: "docs",
			itemPath: "@skills/writing-mr",
			title: "writing-mr",
		});
		expect(findItemByItemPath).not.toHaveBeenCalled();
	});

	test("assertResolvedUnderPath accepts paths under base", () => {
		const base = new Path("docs/guides");
		expect(() => CatalogItemLookup.assertResolvedUnderPath(base, new Path("docs/guides/setup.md"))).not.toThrow();
		expect(() => CatalogItemLookup.assertResolvedUnderPath(base, base)).not.toThrow();
		expect(() => CatalogItemLookup.assertResolvedUnderPath(base, new Path("docs/other/x.md"))).toThrow(
			"Path resolves outside base path",
		);
	});
});
