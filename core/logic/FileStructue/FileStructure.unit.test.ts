import MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import Path from "@core/FileProvider/Path/Path";
import { BACKENDS, type BackendKind, makeBackend } from "@core/FileStructue/backend/testBackends";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import FileStructure, { type CollisionMovement } from "@core/FileStructue/FileStructure";
import { ItemType } from "@core/FileStructue/Item/ItemType";
import { resolve } from "path";

const path = (p: string) => new Path(p);

/** Fixtures are mutated by some tests, so each backend gets its own copy of every catalog root. */
const mount = (kind: BackendKind, fixture: string) =>
	MountFileProvider.fromDefault(new Path(resolve(__dirname, `${fixture}-${kind}`)));

const structure = (kind: BackendKind, fp: MountFileProvider, isReadOnly = false, knownWorkspacePaths: string[] = []) =>
	new FileStructure(fp, isReadOnly, knownWorkspacePaths, makeBackend(kind, fp, knownWorkspacePaths));

// Both backends are held to one suite: neither can change shape, ordering or parsing on its own.
describe.each(BACKENDS)("FileStructure (%s backend)", (kind) => {
	const fp = mount(kind, "catalogs");
	const fs = structure(kind, fp);

	beforeAll(async () => {
		await fp.write(path("_1/2/3/4/5/6/doc-root.yaml"), "");

		await fp.write(path("1/2/3/4/5/doc-root.yaml"), "");
		await fp.write(path("1/2/3/4/5/article.md"), "");

		await fp.write(path("3/catalog3/doc-root.yaml"), "");
		await fp.write(path("3/x/doc-root.yaml"), "");

		await fp.write(path("catalog1/doc-root.yaml"), "");
		await fp.write(path("catalog1/article2.md"), "");
		await fp.write(path("catalog1/1.article3.md"), "");
		await fp.write(path("catalog1/1. article4.md"), "");
		await fp.write(path("catalog1/test_article.md"), "");

		await fp.write(path("catalog1/category1/_index.md"), "");
		await fp.write(path("catalog1/category1/article1.md"), "");
		await fp.write(path("catalog1/category 1/_index.md"), "");
		await fp.write(path("catalog1/category 1/article 1.md"), "");

		await fp.write(path("catalog2/doc-root.yaml"), "");
	});

	afterAll(async () => {
		await fp.delete(Path.empty);
	});

	describe("находит", () => {
		test("каталоги (они есть)", async () => {
			const catalogs = await fs.getCatalogEntries();
			expect(catalogs).toHaveLength(5);
			const paths = catalogs.map((c) => c.getRootCategoryDirectoryPath().value);
			expect(paths).toEqual(["1/2/3/4/5", "3/catalog3", "_1", "catalog1", "catalog2"]);
		});

		test("каталоги (их нет)", async () => {
			const emptyFp = mount(kind, "catalogs/empty");
			const catalogs = await structure(kind, emptyFp).getCatalogEntries();
			expect(catalogs).toHaveLength(0);
		});

		test("статьи", async () => {
			const catalogs: Catalog[] = [];
			for (const entry of await fs.getCatalogEntries()) catalogs.push(await entry.load());

			const articles = catalogs
				.map((c) => c.getItems())
				.map((c) => c.map((a) => a.getFileName()))
				.map((c) => c.sort());

			expect(articles).toEqual([
				["article"],
				[],
				[],
				[
					"1. article4",
					"1.article3",
					"article 1",
					"article1",
					"article2",
					"category 1",
					"category1",
					"test_article",
				],
				[],
			]);
		});
	});

	describe("формирует правильные logicPath у", () => {
		test("разделов", async () => {
			const catalogs: Catalog[] = [];
			for (const entry of await fs.getCatalogEntries()) catalogs.push(await entry.load());

			const articles = catalogs
				.map((c) => c.getCategories())
				.map((c) => c.map((a) => a.logicPath))
				.map((c) => c.sort());

			expect(articles).toEqual([
				["1"],
				["3"],
				["_1"],
				["catalog1", "catalog1/category 1", "catalog1/category1"],
				["catalog2"],
			]);
		});

		test("статей", async () => {
			const catalogs: Catalog[] = [];
			for (const entry of await fs.getCatalogEntries()) catalogs.push(await entry.load());

			const articles = catalogs
				.map((c) => c.getItems())
				.map((c) => c.map((a) => a.logicPath))
				.map((c) => c.sort());

			expect(articles).toEqual([
				["1/article"],
				[],
				[],
				[
					"catalog1/1. article4",
					"catalog1/1.article3",
					"catalog1/article2",
					"catalog1/category 1",
					"catalog1/category 1/article 1",
					"catalog1/category1",
					"catalog1/category1/article1",
					"catalog1/test_article",
				],
				[],
			]);
		});
	});

	describe("создаёт", () => {
		test("каталог", async () => {
			await fs.createCatalog({ title: "test1", url: "test1" });
			const entries = await fs.getCatalogEntries();
			const entry = entries.find((x) => x.name === "test1");
			expect(entry).toBeDefined();
			const catalog = await entry.load();
			expect(catalog).toBeDefined();
			expect(await fp.exists(path("test1/.doc-root.yaml"))).toBeTruthy();
			expect(catalog.getItems()).toHaveLength(0);
		});

		test("статью", async () => {
			const catalog = await fs.getCatalogByPath(path("test1"));
			const article = await catalog.createArticle(null, "");
			expect(article.getFileName()).toEqual("untitled");
			expect(await fp.exists(path("test1/untitled.md"))).toBeTruthy();
		});

		test("категорию", async () => {
			const catalog = await fs.getCatalogByPath(path("test1"));
			await fs.createCategory(
				FileStructure.getCatalogPath(catalog).join(path("category/_index.md")),
				catalog.getRootCategory(),
				// biome-ignore lint/suspicious/noExplicitAny: createCategory only uses these fields, so it's ok
				{ props: {}, content: "content" } as any,
				catalog,
			);

			const actual = await fp.read(path("test1/category/_index.md"));
			expect(actual).not.toBeNull();
			expect(actual).toContain("content");
		});

		test("callback для фильтрации", async () => {
			const catalog = await fs.getCatalogByPath(path("test1"));
			expect(catalog.getItems([() => false])).toHaveLength(0);
		});
	});

	describe("читает", () => {
		test("категорию", async () => {
			const catalog = await fs.getCatalogByPath(path("test1"));
			const category = await fs.makeCategory(
				path("test1/category"),
				catalog.getRootCategory(),
				catalog,
				path("test1/category/_index.md"),
			);
			expect(category).toBeDefined();
			expect(category.type).toEqual(ItemType.category);
		});

		test("категорию вместе с её содержимым", async () => {
			const catalog = await fs.getCatalogByPath(path("catalog1"));
			const category = await fs.makeCategory(
				path("catalog1/category1"),
				catalog.getRootCategory(),
				catalog,
				path("catalog1/category1/_index.md"),
			);
			expect(category.items.map((i) => i.logicPath)).toEqual(["catalog1/category1/article1"]);
		});
	});

	describe("сохраняет", () => {
		test("не пишет в doc-root флаги, которые проставил скан", async () => {
			const entry = await fs.getCatalogEntryByPath(path("catalog1"), true, {
				isGitRepo: true,
				isBareRepo: false,
				hasGitmodules: false,
			});
			const catalog = await entry.load();
			await fs.saveCatalog(catalog);

			const raw = (await fp.read(path("catalog1/doc-root.yaml"))).toString();
			expect(raw).not.toContain("isGitRepo");
			expect(raw).not.toContain("isBareRepo");
			expect(raw).not.toContain("hasGitmodules");
		});

		test("каталог с изменёнными пропсами", async () => {
			const entry = await fs.getCatalogEntryByPath(path("catalog1"));
			const catalog = await entry.load();
			catalog.props.title = "test";
			await fs.saveCatalog(catalog);
			const entry2 = await fs.getCatalogEntryByPath(path("catalog1"));
			expect(entry2.props.title).toEqual("test");
		});
	});

	describe("обрабатывает ошибки", () => {
		test("чтения несуществующего каталога", async () => {
			const catalog = await fs.getCatalogEntryByPath(path("not-exists111"));
			expect(catalog).toBeUndefined();
		});

		test("getCatalogByPath на несуществующем пути падает, а не отдаёт пустой каталог", async () => {
			await expect(fs.getCatalogByPath(path("not-exists111"))).rejects.toThrow(/nothing at/);
		});

		test("getCatalogByPath с checkIsExists=false сканирует несуществующий путь", async () => {
			const catalog = await fs.getCatalogByPath(path("not-exists111"), false);
			expect(catalog.getItems()).toHaveLength(0);
		});
	});

	describe("определяет", () => {
		test("каталог ли это", () => {
			expect(FileStructure.isCatalog(path("test1/doc-root.yaml"))).toBeTruthy();
			expect(FileStructure.isCatalog(path("not-a-catalog"))).toBeFalsy();
			// Exact names only: the pattern this replaced also accepted these, which made `Workspace`
			// react to files the scan would then refuse to resolve as a doc-root.
			expect(FileStructure.isCatalog(path("test1/my-root.yaml"))).toBeFalsy();
			expect(FileStructure.isCatalog(path("test1/aroot.yml"))).toBeFalsy();
		});

		test("путь до каталога", async () => {
			const catalog = await fs.getCatalogByPath(path("catalog1"));
			expect(FileStructure.getCatalogPath(catalog).value).toEqual("catalog1");
		});

		test("имя каталога", async () => {
			const catalog = await fs.getCatalogEntryByPath(path("catalog1"));
			expect(catalog.name).toEqual("catalog1");
		});

		test("имя вложенного каталога", async () => {
			const catalog = await fs.getCatalogEntryByPath(path("3"));
			expect(catalog.name).toEqual("3");
		});

		test("basePath", async () => {
			const entry = await fs.getCatalogEntryByPath(path("3"));
			const catalog = await entry.load();
			expect(catalog.basePath.value).toEqual("3");
		});
	});

	describe("preserves frontmatter types", () => {
		const fpTypes = mount(kind, "catalogs-types");
		const fsTypes = structure(kind, fpTypes);

		beforeAll(async () => {
			await fpTypes.write(path("c/doc-root.yaml"), "");
			await fpTypes.write(
				path("c/article.md"),
				`---\norder: 3\ntitle: A\nweight: 0.5\nexternal: true\nhidden: false\nicon:\nslug: "42"\ntags:\n  - one\n  - 2\n---\nbody`,
			);
			await fpTypes.write(path("c/sub/_index.md"), `---\norder: 1\ntitle: Sub\n---\n`);
			await fpTypes.write(path("c/sub/a.md"), `---\norder: 0.5\ntitle: A\n---\n`);
		});

		afterAll(async () => {
			await fpTypes.delete(Path.empty);
		});

		test("integer order is a number", async () => {
			const catalog = await fsTypes.getCatalogByPath(path("c"));
			const article = catalog.findArticle("c/article", []);
			expect(typeof article.props.order).toBe("number");
			expect(article.props.order).toBe(3);
		});

		test("fractional order preserves float", async () => {
			const catalog = await fsTypes.getCatalogByPath(path("c"));
			const article = catalog.findArticle("c/article", []);
			expect((article.props as Record<string, unknown>).weight).toBe(0.5);
		});

		test("booleans stay booleans", async () => {
			const catalog = await fsTypes.getCatalogByPath(path("c"));
			const article = catalog.findArticle("c/article", []);
			expect(article.props.external).toBe(true);
			expect((article.props as Record<string, unknown>).hidden).toBe(false);
		});

		test("null stays null", async () => {
			const catalog = await fsTypes.getCatalogByPath(path("c"));
			const article = catalog.findArticle("c/article", []);
			expect((article.props as Record<string, unknown>).icon).toBeNull();
		});

		test("quoted numeric stays string", async () => {
			const catalog = await fsTypes.getCatalogByPath(path("c"));
			const article = catalog.findArticle("c/article", []);
			const props = article.props as Record<string, unknown>;
			expect(typeof props.slug).toBe("string");
			expect(props.slug).toBe("42");
		});

		test("category index frontmatter order parsed as number", async () => {
			const catalog = await fsTypes.getCatalogByPath(path("c"));
			const sub = catalog.getCategories().find((c) => c.logicPath === "c/sub");
			expect(sub).toBeDefined();
			expect(typeof sub.props.order).toBe("number");
			expect(sub.props.order).toBe(1);
		});
	});

	// gram-ax/gramax#879: a no-op interaction rewrote the article and swapped `order` with `title`.
	describe("keeps serialized frontmatter keys in their original position", () => {
		const fpOrder = mount(kind, "catalogs-order");
		const fsOrder = structure(kind, fpOrder);

		const frontmatterKeys = (raw: string) => {
			const keys: string[] = [];
			const lines = raw.split("\n");
			// skip the opening `---`, collect each top-level `key:` line until the closing `---`
			for (let i = 1; i < lines.length; i++) {
				if (lines[i] === "---") break;
				const m = lines[i].match(/^([a-zA-Z_][\w-]*):/);
				if (m) keys.push(m[1]);
			}
			return keys;
		};

		beforeAll(async () => {
			await fpOrder.write(path("c/doc-root.yaml"), "");
			// article created without an `order` key yet (fresh article before it is placed in nav)
			await fpOrder.write(path("c/a.md"), `---\ntitle: My Title\ndescription: Desc\n---\nbody`);
			// `order` deliberately above `title` — the pair that swapped in the issue
			await fpOrder.write(path("c/b.md"), `---\norder: 2\ntitle: B\ndescription: Desc\n---\nbody`);
		});

		afterAll(async () => {
			await fpOrder.delete(Path.empty);
		});

		test("scan reports frontmatter keys in file order", async () => {
			const tree = await fsOrder.backend.scanCatalog(path("c"));
			const article = tree.children.find((c) => c.kind === "article" && c.relPath === "b.md");
			expect(Object.keys(article.frontMatter)).toEqual(["order", "title", "description"]);
		});

		test("serialize() emits keys in the order they were given", () => {
			const raw = fsOrder.serialize({
				props: { order: 5, tags: ["x"], title: "T", description: "D" } as never,
				content: "body",
			});
			expect(frontmatterKeys(raw)).toEqual(["order", "tags", "title", "description"]);
		});

		test("rewriting an article leaves order above title where the file put it", async () => {
			const catalog = await fsOrder.getCatalogByPath(path("c"));
			const article = catalog.findArticle("c/b", []);
			await article.setOrder(7);
			const raw = (await fpOrder.read(article.ref.path)).toString();
			expect(article.props.order).toBe(7);
			expect(frontmatterKeys(raw)).toEqual(["order", "title", "description"]);
		});

		test("a brand-new order key is appended last", async () => {
			const catalog = await fsOrder.getCatalogByPath(path("c"));
			const article = catalog.findArticle("c/a", []);
			await article.setOrder(5);
			const raw = (await fpOrder.read(article.ref.path)).toString();
			expect(article.props.order).toBe(5);
			expect(frontmatterKeys(raw)).toEqual(["title", "description", "order"]);
		});
	});

	describe("heals article/category name collisions", () => {
		const fpc = mount(kind, "catalogs-collision");
		const fsc = structure(kind, fpc);

		beforeAll(async () => {
			// fold case: the section index carries frontmatter but no body of its own. Here the index
			// has a title and no description, so the article's description must fill that gap while
			// the section's title wins.
			await fpc.write(path("hc1/doc-root.yaml"), "");
			await fpc.write(
				path("hc1/foo.md"),
				"---\ntitle: Foo Article\ndescription: Article desc\n---\n\narticle body",
			);
			await fpc.write(path("hc1/foo/_index.md"), "---\ntitle: Foo Category\norder: 1\n---\n\n   \n");
			await fpc.write(path("hc1/foo/child.md"), "child body");

			// rename case: both sides have real content
			await fpc.write(path("hc2/doc-root.yaml"), "");
			await fpc.write(path("hc2/foo.md"), "---\ntitle: A\n---\n\nbody A");
			await fpc.write(path("hc2/foo/_index.md"), "---\ntitle: B\n---\n\nbody B");

			// guard: read-only file structure
			await fpc.write(path("hc3/doc-root.yaml"), "");
			await fpc.write(path("hc3/foo.md"), "body A");
			await fpc.write(path("hc3/foo/_index.md"), "body B");

			// guard: git-tree provider
			await fpc.write(path("hc4/doc-root.yaml"), "");
			await fpc.write(path("hc4/foo.md"), "body A");
			await fpc.write(path("hc4/foo/_index.md"), "body B");
		});

		afterAll(async () => {
			await fpc.delete(Path.empty);
		});

		test("folds article into category when index has no own content", async () => {
			const catalog = await fsc.getCatalogByPath(path("hc1"));

			expect(await fpc.exists(path("hc1/foo.md"))).toBe(false);
			const index = await fpc.read(path("hc1/foo/_index.md"));
			expect(index).toContain("article body");
			// section's own frontmatter survives the fold; article props only fill gaps
			expect(index).toContain("Foo Category");
			expect(index).toContain("order: 1");

			const category = catalog.getCategories().find((c) => c.logicPath === "hc1/foo");
			expect(category).toBeDefined();
			expect(category.props.title).toBe("Foo Category");
			expect(category.props.description).toBe("Article desc");
			expect(category.props.order).toBe(1);

			expect(catalog.findArticle("hc1/foo/child", [])).toBeDefined();

			const rootItems = catalog.getRootCategory().items.map((i) => i.logicPath);
			expect(rootItems.filter((l) => l === "hc1/foo")).toHaveLength(1);
		});

		test("renames article to a unique name when both sides have content", async () => {
			// `FSCollisionHealEvents` repoints incoming links off this payload, best-effort — a
			// regression in it shows up as quietly broken links, not as a failure, so assert it here.
			const movements: CollisionMovement[] = [];
			fsc.events.on("catalog-collision-healed", (args) => void movements.push(...args.movements));

			const catalog = await fsc.getCatalogByPath(path("hc2"));

			expect(movements).toHaveLength(1);
			expect(movements[0].oldPath.value).toBe("hc2/foo.md");
			expect(movements[0].newPath.value).toBe("hc2/foo-2.md");

			expect(await fpc.exists(path("hc2/foo.md"))).toBe(false);
			expect(await fpc.exists(path("hc2/foo-2.md"))).toBe(true);
			expect(await fpc.read(path("hc2/foo-2.md"))).toContain("body A");
			expect(await fpc.read(path("hc2/foo/_index.md"))).toContain("body B");

			const logicPaths = catalog
				.getItems()
				.map((i) => i.logicPath)
				.sort();
			expect(logicPaths).toEqual(["hc2/foo", "hc2/foo-2"]);
		});

		test("does not mutate a read-only catalog", async () => {
			const catalog = await structure(kind, fpc, true).getCatalogByPath(path("hc3"));

			expect(await fpc.exists(path("hc3/foo.md"))).toBe(true);
			expect(await fpc.exists(path("hc3/foo/_index.md"))).toBe(true);

			const logicPaths = catalog.getItems().map((i) => i.logicPath);
			expect(logicPaths.filter((l) => l === "hc3/foo")).toHaveLength(2);
		});

		test("does not mutate when the file provider is a git-tree provider", async () => {
			const fpGit = mount(kind, "catalogs-collision");
			const provider = fpGit.default();
			// Only the provider *kind* is faked — that is what the healing guard keys off. The scan
			// still reads the real directory, so it needs the scope a git provider would hand it.
			Object.defineProperty(provider, "kind", { get: () => "git" });
			Object.defineProperty(provider, "getNativeScope", {
				value: (p: Path) => ({ scope: { kind: "disk", root: provider.rootPath.value }, scopedPath: p.value }),
			});

			const catalog = await structure(kind, fpGit).getCatalogByPath(path("hc4"));

			expect(await fpc.exists(path("hc4/foo.md"))).toBe(true);
			expect(await fpc.exists(path("hc4/foo/_index.md"))).toBe(true);

			const logicPaths = catalog.getItems().map((i) => i.logicPath);
			expect(logicPaths.filter((l) => l === "hc4/foo")).toHaveLength(2);
		});
	});

	describe("filters nested workspaces", () => {
		const fpNested = mount(kind, "catalogs-nested-ws");

		beforeAll(async () => {
			await fpNested.write(path("catalog-ok/doc-root.yaml"), "");
			await fpNested.write(path("nested-ws-direct/workspace.yaml"), "");
			await fpNested.write(path("projects/readme.md"), "");
		});

		afterAll(async () => {
			await fpNested.delete(Path.empty);
		});

		test("excludes dir with workspace.yaml (direct nesting)", async () => {
			const entries = await structure(kind, fpNested).getCatalogEntries();
			const names = entries.map((e) => e.name);
			expect(names).not.toContain("nested-ws-direct");
			expect(names).toContain("catalog-ok");
		});

		test("excludes dir containing a registered workspace (indirect nesting)", async () => {
			const knownWsPath = resolve(fpNested.rootPath.value, "projects", "workspace-b");
			const entries = await structure(kind, fpNested, false, [knownWsPath]).getCatalogEntries();
			const names = entries.map((e) => e.name);
			expect(names).not.toContain("projects");
			expect(names).toContain("catalog-ok");
		});
	});
});
