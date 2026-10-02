import Path from "@core/FileProvider/Path/Path";
import { ItemType } from "@core/FileStructue/Item/ItemType";
import { agentConfig } from "../../core/agentConfig";
import { LineMatcher } from "./lines";
import { SearchResults } from "./searchResults";

const ctx = {} as never;
const commands = {} as never;

const createItem = (catalogName: string, itemPath: string, title: string, content: string) => ({
	type: ItemType.article,
	props: { title },
	ref: { path: new Path(`${catalogName}/${itemPath}`) },
	getTitle: () => title,
	getContent: async () => content,
});

const createApp = (item: ReturnType<typeof createItem> | undefined, catalogName = "docs") => {
	const catalog = {
		name: catalogName,
		props: {},
		findItemByItemPath: () => item,
		getRootCategoryRef: () => ({ path: new Path("doc-root.yml") }),
		getRepositoryRelativePath: (ref: { path: Path }) => new Path(ref.path.value.slice(catalogName.length + 1)),
		getPathname: async () => "source/-/repo/branch/docs/section/a.md",
		getContextlessCatalog: async () => null,
	};

	return {
		wm: { current: () => ({ getCatalog: async () => catalog, getContextlessCatalog: async () => catalog }) },
	} as never;
};

const defaultApp = createApp(undefined);

const articleHit = (refPath: string, items: unknown[]) => ({
	refPath,
	catalog: { name: "docs" },
	items,
});

const compact = async (app: never, raw: unknown, maxHits: number, maxMatchesPerHit: number, query = "match") =>
	(
		await SearchResults.compact({
			app,
			ctx,
			commands,
			raw,
			maxHits,
			maxMatchesPerHit,
			matcher: LineMatcher.build(query, false),
		})
	).hits;

describe("SearchResults.compact", () => {
	test("returns empty array for non-array input", async () => {
		await expect(compact(defaultApp, null, 5, 2)).resolves.toEqual([]);
	});

	test("returns empty array for empty input", async () => {
		await expect(compact(defaultApp, [], 5, 2)).resolves.toEqual([]);
	});

	test("parses refPath into catalogName and itemPath", async () => {
		const raw = [articleHit("docs/section/a.md", [{ searchText: "match one" }])];

		await expect(compact(defaultApp, raw, 5, 2)).resolves.toEqual([
			{ catalogName: "docs", itemPath: "section/a", title: "", matches: [{ line: null, text: "match one" }] },
		]);
	});

	test("resolves line numbers from the agent view, counting the generated frontmatter", async () => {
		const item = createItem("docs", "section/a.md", "Article A", "# Title\n\nfirst line\nline with match here");
		const raw = [articleHit("docs/section/a.md", [{ searchText: "irrelevant index snippet" }])];

		const result = await compact(createApp(item), raw, 5, 2);
		expect(result[0]?.matches).toEqual([{ line: 7, text: "line with match here" }]);
	});

	test("falls back to index snippets with line null when there is no literal match", async () => {
		const item = createItem("docs", "section/a.md", "Article A", "# Title\n\nсовпадению по словоформе");
		const raw = [articleHit("docs/section/a.md", [{ searchText: "совпадению по словоформе" }])];

		const result = await compact(createApp(item), raw, 5, 2, "совпадение");
		expect(result[0]?.matches).toEqual([{ line: null, text: "совпадению по словоформе" }]);
	});

	test("keeps the hit when the article content cannot be read at all", async () => {
		const item = createItem("docs", "section/a.md", "Article A", "");
		item.getContent = async () => {
			throw new Error("File not found");
		};
		const raw = [articleHit("docs/section/a.md", [{ searchText: "index snippet survives" }])];

		const result = await compact(createApp(item), raw, 5, 2);
		expect(result).toHaveLength(1);
		expect(result[0]?.matches).toEqual([{ line: null, text: "index snippet survives" }]);
	});

	test("keeps the hit with line null when the agent view fails to build", async () => {
		const item = createItem(
			"docs",
			"section/a.md",
			"Article A",
			'# Title\n\n<mermaid path="" />\nline with match here',
		);
		const raw = [articleHit("docs/section/a.md", [{ searchText: "index snippet survives" }])];

		const result = await compact(createApp(item), raw, 5, 2);
		expect(result).toHaveLength(1);
		expect(result[0]?.matches).toEqual([{ line: null, text: "index snippet survives" }]);
	});

	test("reports hasMore when the engine found more than maxHits", async () => {
		const raw = [
			articleHit("docs/a.md", [{ searchText: "match a" }]),
			articleHit("docs/b.md", [{ searchText: "match b" }]),
			articleHit("docs/c.md", [{ searchText: "match c" }]),
		];

		const result = await SearchResults.compact({
			app: defaultApp,
			ctx,
			commands,
			raw,
			maxHits: 2,
			maxMatchesPerHit: 1,
			matcher: LineMatcher.build("match", false),
		});
		expect(result.hits).toHaveLength(2);
		expect(result.hasMore).toBe(true);
	});

	test("does not report hasMore when everything found fits into maxHits", async () => {
		const raw = [articleHit("docs/a.md", [{ searchText: "match a" }])];

		const result = await SearchResults.compact({
			app: defaultApp,
			ctx,
			commands,
			raw,
			maxHits: 1,
			maxMatchesPerHit: 1,
			matcher: LineMatcher.build("match", false),
		});
		expect(result.hits).toHaveLength(1);
		expect(result.hasMore).toBe(false);
	});

	test("keeps search engine order", async () => {
		const raw = [
			articleHit("docs/low.md", [{ searchText: "weak match" }]),
			articleHit("docs/high.md", [{ searchText: "strong match" }]),
		];

		const result = await compact(defaultApp, raw, 5, 2);
		expect(result.map((h) => h.itemPath)).toEqual(["low", "high"]);
	});

	test("limits number of hits", async () => {
		const raw = [
			articleHit("docs/a.md", [{ searchText: "match a" }]),
			articleHit("docs/b.md", [{ searchText: "match b" }]),
			articleHit("docs/c.md", [{ searchText: "match c" }]),
		];

		const result = await compact(defaultApp, raw, 2, 1);
		expect(result).toHaveLength(2);
	});

	test("limits matches per hit", async () => {
		const raw = [articleHit("docs/a.md", [{ searchText: "first match" }, { searchText: "second match" }])];

		const result = await compact(defaultApp, raw, 5, 1);
		expect(result[0]?.matches).toEqual([{ line: null, text: "first match" }]);
	});

	test("collects snippets from nested items", async () => {
		const raw = [
			articleHit("docs/a.md", [
				{
					items: [{ searchText: "nested match" }],
				},
			]),
		];

		const result = await compact(defaultApp, raw, 5, 2);
		expect(result[0]?.matches).toEqual([{ line: null, text: "nested match" }]);
	});

	test("skips hits without refPath", async () => {
		const raw = [{ items: [{ searchText: "x" }] }, articleHit("docs/ok.md", [{ searchText: "y" }])];

		const result = await compact(defaultApp, raw, 5, 2);
		expect(result).toHaveLength(1);
		expect(result[0]?.itemPath).toBe("ok");
	});

	test("skips refPath without item segment", async () => {
		const raw = [articleHit("docs", [{ searchText: "x" }]), articleHit("docs/ok.md", [{ searchText: "y" }])];

		const result = await compact(defaultApp, raw, 5, 2);
		expect(result).toHaveLength(1);
		expect(result[0]?.itemPath).toBe("ok");
	});
});

describe("resolveMaxHits", () => {
	test("falls back to the default when nothing is passed", () => {
		expect(SearchResults.resolveMaxHits(undefined)).toBe(agentConfig.searchHitsDefault);
		expect(SearchResults.resolveMaxHits(null)).toBe(agentConfig.searchHitsDefault);
		expect(SearchResults.resolveMaxHits("")).toBe(agentConfig.searchHitsDefault);
	});

	test("accepts any integer above zero", () => {
		expect(SearchResults.resolveMaxHits(1)).toBe(1);
		expect(SearchResults.resolveMaxHits(42)).toBe(42);
	});

	test("clamps a value above the ceiling", () => {
		expect(SearchResults.resolveMaxHits(1000)).toBe(agentConfig.searchHitsMax);
	});

	test("accepts a number sent as a string", () => {
		expect(SearchResults.resolveMaxHits("42")).toBe(42);
	});

	test("rejects zero, negative and fractional values", () => {
		expect(() => SearchResults.resolveMaxHits(0)).toThrow("maxHits must be an integer starting from 1");
		expect(() => SearchResults.resolveMaxHits(-3)).toThrow("maxHits must be an integer starting from 1");
		expect(() => SearchResults.resolveMaxHits(2.5)).toThrow("maxHits must be an integer starting from 1");
	});

	test("rejects a value that is not a number", () => {
		expect(() => SearchResults.resolveMaxHits("many")).toThrow("maxHits must be an integer starting from 1");
	});
});
