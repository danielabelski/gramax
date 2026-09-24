import { createCommands } from "@app/commands";
import getApp from "@app/web/app";
import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type { UpdateItemProps } from "@core/FileStructue/Item/Item";
import ResourceUpdater from "@core/Resource/ResourceUpdater";
import { resolveRootCategory } from "@ext/localization/core/catalogExt";
import { ContentLanguage } from "@ext/localization/core/model/Language";
import { resolve } from "path";

process.env.ROOT_PATH = resolve(__dirname, "tests-alias-multilang");

const p = (s: string) => new Path(s);

const dfp = new DiskFileProvider(p(process.env.ROOT_PATH));

const RU_ARTICLE = "ml/setup";
const EN_ARTICLE = "ml/en/setup";

const makeApp = async () => {
	delete global.app;
	delete global.commands;

	const app = await getApp();
	const wm = app.wm.current();
	const ctx = await app.contextFactory.fromWeb({ language: "ru" });

	const makeResourceUpdater = (catalog: Catalog) =>
		new ResourceUpdater(ctx, catalog, app.parser, app.parserContextFactory, app.formatter);

	return { app, ctx, wm, fp: wm.getFileProvider(), makeResourceUpdater };
};

// the props editor always submits the whole props object, so the title travels with the alias
const setAlias = async (logicPath: string, alias: string) => {
	const { wm, fp, makeResourceUpdater } = await makeApp();
	const catalog = await wm.getContextlessCatalog("ml");
	const item = catalog.findArticle(logicPath, []);
	expect(item).not.toBeNull();

	await catalog.updateItemProps(
		item,
		{ title: item.props.title, aliases: [alias] } as unknown as UpdateItemProps,
		makeResourceUpdater,
	);

	return { catalog, fp };
};

// PRD §6: the alias is stored in the main-language file only; the server mirrors the
// redirect into every language URL space with the same path structure. So whichever
// language version the alias was typed in, the result must be the same: one entry in
// the ru file, none in the translation, and both `ml/<alias>` and `ml/en/<alias>` resolving.
const expectAliasMirroredToEveryLanguage = async (catalog: Catalog, fp: FileProvider, alias: string) => {
	const ru = (await fp.read(p("ml/setup.md"))).toString();
	const en = (await fp.read(p("ml/en/setup.md"))).toString();

	expect(ru).toContain("aliases:");
	expect(ru).toContain(alias);
	expect(en).not.toContain("aliases");

	expect(catalog.aliases.findArticle(`ml/${alias}`, [])?.logicPath).toBe(RU_ARTICLE);

	const enRoot = resolveRootCategory(catalog, catalog.props, ContentLanguage.en);
	expect(enRoot).not.toBeNull();
	expect(catalog.aliases.findArticle(`ml/en/${alias}`, [], enRoot)?.logicPath).toBe(EN_ARTICLE);
};

describe("Alias set in a multilingual catalog", () => {
	beforeEach(async () => {
		await dfp.write(
			p("ml/.doc-root.yaml"),
			`language: ru
supportedLanguages:
  - ru
  - en`,
		);

		await dfp.write(p("ml/setup.md"), "---\ntitle: Установка\n---\n\nru\n");
		await dfp.write(p("ml/guide/_index.md"), "---\ntitle: Руководство\n---\n");
		await dfp.write(p("ml/en/_index.md"), "");
		await dfp.write(p("ml/en/setup.md"), "---\ntitle: Setup\n---\n\nen\n");
		await dfp.write(p("ml/en/guide/_index.md"), "---\ntitle: Guide\n---\n");
	});

	afterEach(async () => {
		await dfp.delete(p("."));
		delete global.app;
	});

	describe("from the main-language (ru) article", () => {
		test("single-segment alias redirects in both language spaces", async () => {
			const { catalog, fp } = await setAlias(RU_ARTICLE, "install");
			await expectAliasMirroredToEveryLanguage(catalog, fp, "install");
		});

		test("multi-segment alias redirects in both language spaces", async () => {
			const { catalog, fp } = await setAlias(RU_ARTICLE, "docs/legacy/install");
			await expectAliasMirroredToEveryLanguage(catalog, fp, "docs/legacy/install");
		});
	});

	describe("from the translated (en) article", () => {
		test("single-segment alias redirects in both language spaces", async () => {
			const { catalog, fp } = await setAlias(EN_ARTICLE, "install");
			await expectAliasMirroredToEveryLanguage(catalog, fp, "install");
		});

		test("multi-segment alias redirects in both language spaces", async () => {
			const { catalog, fp } = await setAlias(EN_ARTICLE, "docs/legacy/install");
			await expectAliasMirroredToEveryLanguage(catalog, fp, "docs/legacy/install");
		});
	});

	// the props editor blocks an alias that is already taken; the ones it shows on a translation
	// belong to its own twin, and counting them as taken made the dialog refuse to save
	test("aliases of the main-language twin are not taken for the translation", async () => {
		const { app, ctx, wm, makeResourceUpdater } = await makeApp();
		const catalog = await wm.getContextlessCatalog("ml");
		const ru = catalog.findArticle(RU_ARTICLE, []);
		await catalog.updateItemProps(
			ru,
			{ title: ru.props.title, aliases: ["install"] } as unknown as UpdateItemProps,
			makeResourceUpdater,
		);

		const getTakenAliases = createCommands(app).article.features.getTakenAliases;
		const taken = await getTakenAliases.do({ ctx, catalogName: "ml", path: p("ml/en/setup.md") });

		expect(taken).not.toContain("install");
	});

	// the auto alias written on rename/move follows the same rule as a typed one
	describe("auto alias of a translated article", () => {
		test("renaming it records the alias on the main-language twin", async () => {
			const { wm, fp, makeResourceUpdater } = await makeApp();
			const catalog = await wm.getContextlessCatalog("ml");
			const en = catalog.findArticle(EN_ARTICLE, []);

			await catalog.updateItemProps(
				en,
				{ title: en.props.title, fileName: "setup-guide" } as unknown as UpdateItemProps,
				makeResourceUpdater,
			);

			expect((await fp.read(p("ml/setup-guide.md"))).toString()).toContain("path: setup");
			expect((await fp.read(p("ml/en/setup-guide.md"))).toString()).not.toContain("aliases");

			expect(catalog.aliases.findArticle("ml/setup", [])?.logicPath).toBe("ml/setup-guide");
			const enRoot = resolveRootCategory(catalog, catalog.props, ContentLanguage.en);
			expect(catalog.aliases.findArticle("ml/en/setup", [], enRoot)?.logicPath).toBe("ml/en/setup-guide");
		});

		test("moving it into a section records the alias on the main-language twin", async () => {
			const { wm, fp, makeResourceUpdater } = await makeApp();
			const catalog = await wm.getContextlessCatalog("ml");
			const en = catalog.findArticle(EN_ARTICLE, []);

			await catalog.moveItem(
				en.ref,
				{ path: p("ml/en/guide/setup.md"), storageId: en.ref.storageId },
				makeResourceUpdater,
				[],
			);

			expect((await fp.read(p("ml/guide/setup.md"))).toString()).toContain("path: setup");
			expect((await fp.read(p("ml/en/guide/setup.md"))).toString()).not.toContain("aliases");

			// the mirrored move is silent — the tree picks the moved twins up on the next read
			await catalog.update();

			expect(catalog.aliases.findArticle("ml/setup", [])?.logicPath).toBe("ml/guide/setup");
			const enRoot = resolveRootCategory(catalog, catalog.props, ContentLanguage.en);
			expect(catalog.aliases.findArticle("ml/en/setup", [], enRoot)?.logicPath).toBe("ml/en/guide/setup");
		});
	});
});
