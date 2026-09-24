import getApp from "@app/node/app";
import type Application from "@app/types/Application";
import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { Article } from "@core/FileStructue/Article/Article";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type { Category } from "@core/FileStructue/Category/Category";
import ResourceUpdater from "@core/Resource/ResourceUpdater";
import { addExternalItems } from "@ext/localization/core/addExternalItems";
import type { Workspace } from "@ext/workspace/Workspace";
import { resolve } from "path";

let app: Application;
let fp: FileProvider;
let workspace: Workspace;

const p = (s: string) => new Path(s);

const getMakeResourceUpdater = async () => {
	const ctx = await app.contextFactory.fromWeb({ language: "ru" });
	return (catalog: Catalog) => new ResourceUpdater(ctx, catalog, app.parser, app.parserContextFactory, app.formatter);
};

// The slug field of the props dialog: only `fileName` changes, every other prop is left out.
const rename = async (catalog: Catalog, path: string, fileName: string): Promise<Article> => {
	const article = catalog.findItemByItemPath<Article>(p(path));
	const makeResourceUpdater = await getMakeResourceUpdater();
	await article.updateProps(
		{ logicPath: article.logicPath, fileName } as never,
		makeResourceUpdater(catalog),
		catalog,
	);
	return article;
};

// Full props dialog submit. The JSON round trip is not decoration: SitePresenter serializes
// the props into the response, usePropsEditorAcitions posts them back, and only then does
// Item.updateProps see them — so a `moved` that is not a string on disk arrives here as one.
const submitProps = async (catalog: Catalog, path: string, patch: Record<string, unknown>): Promise<void> => {
	const article = catalog.findItemByItemPath<Article>(p(path));
	const makeResourceUpdater = await getMakeResourceUpdater();
	const clientProps = JSON.parse(JSON.stringify({ ...article.props, logicPath: article.logicPath, ...patch }));
	await article.updateProps(clientProps, makeResourceUpdater(catalog), catalog);
};

const kinds = (catalog: Catalog, kind: string) => catalog.aliases.diagnostics().filter((d) => d.kind === kind);

describe("Alias redirects", () => {
	beforeAll(async () => {
		process.env.ROOT_PATH = resolve(__dirname, "tests-alias");
		const dfp = new DiskFileProvider(p(process.env.ROOT_PATH));

		await dfp.write(p("al/.doc-root.yaml"), "");
		await dfp.write(p("al/install.md"), "# install\n\nbody\n");
		await dfp.write(p("al/guide/_index.md"), "---\ntitle: guide\naliases:\n  - old-guide\n---\n\nbody\n");
		await dfp.write(p("al/guide/setup.md"), "# setup\n\nbody\n");
		await dfp.write(p("al/renamed.md"), "---\ntitle: manual\naliases:\n  - legacy/page\n---\n\nbody\n");
		await dfp.write(p("al/untitled.md"), "# fresh\n\nbody\n");
		await dfp.write(p("al/new-article-2.md"), "# fresh too\n\nbody\n");

		await dfp.write(p("ml/.doc-root.yaml"), "language: ru\nsupportedLanguages:\n  - ru\n  - en");
		await dfp.write(p("ml/setup.md"), "---\ntitle: Setup\naliases:\n  - install\n---\n\nru\n");
		await dfp.write(p("ml/en/_index.md"), "");
		await dfp.write(p("ml/en/setup.md"), "---\ntitle: Setup EN\n---\n\nen\n");

		// `sh` and `mv` start clean: the auto aliases under test are written by the product
		// itself during the tests, which is the whole point — the shadowing must not arise
		// from a sequence of ordinary renames and moves.
		await dfp.write(p("sh/.doc-root.yaml"), "");
		await dfp.write(p("sh/aaa.md"), "# aaa\n\nbody\n");
		await dfp.write(p("sh/other.md"), "# other\n\nbody\n");
		await dfp.write(p("sh/new-article-9.md"), "# fresh\n\nbody\n");

		await dfp.write(p("mv/.doc-root.yaml"), "");
		await dfp.write(p("mv/x.md"), "# x\n\nbody\n");
		await dfp.write(p("mv/guide/_index.md"), "---\ntitle: guide\n---\n\nbody\n");
		await dfp.write(p("mv/guide/y.md"), "# y\n\nbody\n");

		// `lk` is already in the broken state a pre-fix Gramax left on disk: the auto alias
		// `aaa` on `bbb` points at a path where a real article lives.
		await dfp.write(p("lk/.doc-root.yaml"), "");
		await dfp.write(p("lk/aaa.md"), "# aaa\n\nbody\n");
		await dfp.write(
			p("lk/bbb.md"),
			'---\ntitle: bbb\naliases:\n  - path: aaa\n    moved: "2026-01-01T00:00:00Z"\n---\n\nbody\n',
		);

		// `bm` carries an unquoted `moved:` — gray-matter parses that into a Date, not a string.
		await dfp.write(
			p("bm/page.md"),
			"---\ntitle: Page\naliases:\n  - path: legacy/page\n    moved: 2026-01-01T00:00:00Z\n---\n\nbody\n",
		);
		await dfp.write(p("bm/.doc-root.yaml"), "");

		// `dp` is already in a state the write path forbids: two articles both claim the manual
		// alias `shared/alias`. A pre-fix Gramax could reach this through an import or a merge —
		// editing either article's props must not crash on the standing duplicate (gh#934).
		await dfp.write(p("dp/.doc-root.yaml"), "");
		await dfp.write(p("dp/one.md"), "---\ntitle: One\naliases:\n  - shared/alias\n---\n\nbody\n");
		await dfp.write(p("dp/two.md"), "---\ntitle: Two\naliases:\n  - shared/alias\n---\n\nbody\n");
		await dfp.write(p("dp/three.md"), "---\ntitle: Three\naliases:\n  - taken/alias\n---\n\nbody\n");

		// `tr` has an aliased ru article and an empty `en` language folder, so the untranslated
		// stub for `setup` is built by addExternalItems during the test.
		await dfp.write(p("tr/.doc-root.yaml"), "language: ru\nsupportedLanguages:\n  - ru\n  - en");
		await dfp.write(
			p("tr/setup.md"),
			'---\ntitle: Setup\naliases:\n  - path: install\n    moved: "2026-01-01T00:00:00Z"\n---\n\nru\n',
		);
		await dfp.write(p("tr/en/_index.md"), "");

		app = await getApp();
		fp = app.wm.current().getFileProvider();
		workspace = app.wm.current();
	});

	afterAll(async () => {
		await fp.delete(p("."));
		delete global.app;
	});

	test("DnD move writes an auto alias and the old path resolves to the moved article", async () => {
		// moveItem is the DnD entry point; the auto entry must carry a UTC moved
		// timestamp — its presence is what distinguishes it from a manual alias
		const catalog = await workspace.getContextlessCatalog("al");
		const article = catalog.findItemByItemPath(p("al/install.md"));
		const guide = catalog.findItemByItemPath(p("al/guide/_index.md"));

		await catalog.moveItem(
			article.ref,
			{ path: p("al/guide/install.md"), storageId: article.ref.storageId },
			await getMakeResourceUpdater(),
			[],
		);

		const moved = await fp.read(p("al/guide/install.md"));
		expect(moved).toContain("aliases:");
		expect(moved).toContain("path: install");
		expect(moved).toMatch(/moved: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);

		const found = catalog.aliases.findArticle(`${catalog.getRootCategory().logicPath}/install`, []);
		expect(found?.logicPath).toBe(
			guide ? `${catalog.getRootCategory().logicPath}/guide/install` : found?.logicPath,
		);
	});

	test("manual alias resolves after catalog read, alias survives article rewrite", async () => {
		const catalog = await workspace.getContextlessCatalog("al");
		const root = catalog.getRootCategory().logicPath;

		const found = catalog.aliases.findArticle(`${root}/legacy/page`, []);
		expect(found?.logicPath).toBe(`${root}/renamed`);

		// re-save the article through the normal update path — alias must survive
		const article = catalog.findItemByItemPath<Article>(p("al/renamed.md"));
		await article.updateContent("new body");
		const raw = await fp.read(p("al/renamed.md"));
		expect(raw).toContain("aliases:");
		expect(raw).toContain("legacy/page");
	});

	test("first slug rename of a new article records no alias", async () => {
		// "untitled"/"new-article-*" names are placeholders (NEW_ARTICLE_REGEX) —
		// nobody ever linked to them, so renaming must not leave an alias behind
		const catalog = await workspace.getContextlessCatalog("al");
		const makeResourceUpdater = await getMakeResourceUpdater();
		const article = catalog.findItemByItemPath<Article>(p("al/untitled.md"));

		await article.updateProps(
			{ logicPath: article.logicPath, fileName: "fresh" } as never,
			makeResourceUpdater(catalog),
			catalog,
		);

		const raw = await fp.read(p("al/fresh.md"));
		expect(raw).not.toContain("aliases");
	});

	test("moving a new article records no alias either", async () => {
		const catalog = await workspace.getContextlessCatalog("al");
		const article = catalog.findItemByItemPath(p("al/new-article-2.md"));

		await catalog.moveItem(
			article.ref,
			{ path: p("al/guide/new-article-2.md"), storageId: article.ref.storageId },
			await getMakeResourceUpdater(),
			[],
		);

		const raw = await fp.read(p("al/guide/new-article-2.md"));
		expect(raw).not.toContain("aliases");
	});

	test("path that nothing aliases resolves to null instead of a guess", async () => {
		const catalog = await workspace.getContextlessCatalog("al");
		const root = catalog.getRootCategory().logicPath;

		expect(catalog.aliases.findArticle(`${root}/no-such-alias`, [])).toBeNull();
	});

	test("category alias redirects its descendants by prefix", async () => {
		// alias 'old-guide' lives on the guide category; a child requested under the
		// old prefix must land on the same child under the category's real path
		const catalog = await workspace.getContextlessCatalog("al");
		const root = catalog.getRootCategory().logicPath;

		const child = catalog.aliases.findArticle(`${root}/old-guide/setup`, []);
		expect(child?.logicPath).toBe(`${root}/guide/setup`);
	});

	test("language URL space mirrors main-language aliases (PRD §6)", async () => {
		const catalog = await workspace.getContextlessCatalog("ml");
		const mainRoot = catalog.getRootCategory().logicPath;

		// main space resolves directly
		const main = catalog.aliases.findArticle(`${mainRoot}/install`, []);
		expect(main?.logicPath).toBe(`${mainRoot}/setup`);

		// en space: alias lives in the ru file, but the reader is redirected to the en translation
		const enRoot = catalog.findArticle(`${mainRoot}/en`, []);
		const en = catalog.aliases.findArticle(`${mainRoot}/en/install`, [], enRoot as never);
		expect(en?.logicPath).toBe(`${mainRoot}/en/setup`);
	});

	// Every diagnostic below is one the product used to create by itself out of ordinary user
	// actions — a rename, a drag-and-drop, adding a language. None of them may appear in the
	// healthcheck panel unless the user hand-wrote the frontmatter that causes it.
	describe("Aliases the product must not break by itself", () => {
		test("renaming another article onto an auto alias clears that alias (new article included)", async () => {
			// `new-article-9` records no alias of its own when renamed, but it still comes to
			// occupy `aaa` — so releasing the destination cannot hang off the alias-recording flag
			const catalog = await workspace.getContextlessCatalog("sh");

			await rename(catalog, "sh/aaa.md", "bbb");
			expect(await fp.read(p("sh/bbb.md"))).toContain("path: aaa");

			await rename(catalog, "sh/new-article-9.md", "aaa");

			expect(await fp.read(p("sh/bbb.md"))).not.toContain("aliases");
			expect(await fp.read(p("sh/aaa.md"))).not.toContain("aliases");
			expect(kinds(catalog, "shadowed-by-real")).toEqual([]);
		});

		test("a normal rename onto an auto alias clears it and keeps its own alias", async () => {
			const catalog = await workspace.getContextlessCatalog("sh");

			await rename(catalog, "sh/bbb.md", "ddd");
			expect(await fp.read(p("sh/ddd.md"))).toContain("path: bbb");

			await rename(catalog, "sh/other.md", "bbb");

			// `ddd` loses the now-shadowed claim on `bbb`; `bbb` keeps the fresh claim on `other`
			expect(await fp.read(p("sh/ddd.md"))).not.toContain("aliases");
			expect(await fp.read(p("sh/bbb.md"))).toContain("path: other");
			expect(kinds(catalog, "shadowed-by-real")).toEqual([]);
		});

		test("DnD-moving an article onto an auto alias clears that alias", async () => {
			const catalog = await workspace.getContextlessCatalog("mv");
			const makeResourceUpdater = await getMakeResourceUpdater();

			const x = catalog.findItemByItemPath(p("mv/x.md"));
			await catalog.moveItem(
				x.ref,
				{ path: p("mv/guide/x.md"), storageId: x.ref.storageId },
				makeResourceUpdater,
				[],
			);
			expect(await fp.read(p("mv/guide/x.md"))).toContain("path: x");

			const y = catalog.findItemByItemPath(p("mv/guide/y.md"));
			await catalog.moveItem(y.ref, { path: p("mv/x.md"), storageId: y.ref.storageId }, makeResourceUpdater, []);

			expect(await fp.read(p("mv/guide/x.md"))).not.toContain("aliases");
			expect(kinds(catalog, "shadowed-by-real")).toEqual([]);
		});

		test("a props save on an article whose auto alias is already shadowed is not blocked", async () => {
			// The blocker users actually hit: assertFree rejects the alias the product wrote,
			// so title and description could not be saved until the alias was deleted by hand
			const catalog = await workspace.getContextlessCatalog("lk");

			await submitProps(catalog, "lk/bbb.md", { description: "edited" });

			const raw = await fp.read(p("lk/bbb.md"));
			expect(raw).toContain("description: edited");
			expect(raw).not.toContain("aliases");
		});

		test("a props save on an article that shares a manual alias with another is not blocked (gh#934)", async () => {
			// Both `one` and `two` claim `shared/alias`. Editing one article's description resubmits
			// its unchanged alias list; re-validating the alias it already holds used to throw
			// "already used by 'two'", so the props could not be saved despite the edit touching
			// no alias — while the change was applied anyway, making the error a false alarm.
			const catalog = await workspace.getContextlessCatalog("dp");

			await submitProps(catalog, "dp/one.md", { description: "edited" });

			const raw = await fp.read(p("dp/one.md"));
			expect(raw).toContain("description: edited");
			expect(raw).toContain("shared/alias");
		});

		test("adding a brand-new alias another article already claims is still rejected (gh#934)", async () => {
			// `three` owns `taken/alias`; `one` does not. Introducing it on `one` is a genuine new
			// conflict — the grandfather rule must not swallow it.
			const catalog = await workspace.getContextlessCatalog("dp");

			await expect(
				submitProps(catalog, "dp/one.md", { aliases: ["shared/alias", "taken/alias"] }),
			).rejects.toThrow("already used by 'three'");
		});

		test("a props save canonicalises a non-string moved instead of writing a broken one", async () => {
			const catalog = await workspace.getContextlessCatalog("bm");

			await submitProps(catalog, "bm/page.md", { description: "edited" });

			const raw = await fp.read(p("bm/page.md"));
			expect(raw).toContain('moved: "2026-01-01T00:00:00Z"');
			expect(raw).not.toContain(".000Z");
			expect(kinds(catalog, "broken-moved")).toEqual([]);
		});

		test("an untranslated stub does not clone the owner's aliases", async () => {
			const catalog = await workspace.getContextlessCatalog("tr");
			const root = catalog.getRootCategory();
			const en = catalog.findArticle(`${root.logicPath}/en`, []) as never as Category;

			await addExternalItems(
				root,
				en,
				root.folderPath,
				en.folderPath,
				workspace.getFileStructure(),
				catalog.props.supportedLanguages,
			);

			expect(await fp.read(p("tr/en/setup.md"))).not.toContain("aliases");
			await catalog.update();
			expect(kinds(catalog, "duplicate")).toEqual([]);
		});
	});
});
