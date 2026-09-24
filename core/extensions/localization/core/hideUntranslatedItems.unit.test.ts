import * as env from "@app/resolveModule/env";
import { EventEmitter } from "@core/Event/EventEmitter";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type FileStructure from "@core/FileStructue/FileStructure";
import type { FSEvents } from "@core/FileStructue/FileStructure";
import type { Item } from "@core/FileStructue/Item/Item";
import { ItemType } from "@core/FileStructue/Item/ItemType";
import FSLocalizationEvents from "@ext/localization/core/events/FSLocalizationEvents";
import { hideUntranslatedItems } from "@ext/localization/core/hideUntranslatedItems";

// The pruning only reads type/props/items/logicPath and resolves the language root through
// findArticle, so a flat logic-path index is a faithful stand-in for the catalog tree.
type MockItem = {
	logicPath: string;
	type: ItemType;
	props: { title?: string; external?: string; order?: number };
	items?: MockItem[];
};

const article = (logicPath: string, title?: string): MockItem => ({
	logicPath,
	type: ItemType.article,
	props: title ? { title } : {},
});

const category = (logicPath: string, items: MockItem[], title?: string): MockItem => ({
	logicPath,
	type: ItemType.category,
	props: title ? { title } : {},
	items,
});

const makeCatalog = (name: string, language: string, supportedLanguages: string[], roots: MockItem[]) => {
	const index = new Map<string, MockItem>();
	const add = (item: MockItem) => {
		index.set(item.logicPath, item);
		item.items?.forEach(add);
	};
	roots.forEach(add);

	return {
		name,
		props: { language, supportedLanguages },
		isFpReadOnly: true,
		resetSearcherCache: () => {},
		findArticle: (logicPath: string, filters: ((i: Item) => boolean)[]) => {
			const found = index.get(logicPath);
			if (!found) return null;
			return filters.every((f) => f(found as unknown as Item)) ? found : null;
		},
	} as unknown as Catalog;
};

const logicPaths = (item: MockItem) => item.items.map((i) => i.logicPath);

describe("catalog-read на портале", () => {
	afterEach(() => jest.restoreAllMocks());

	const readCatalog = async (catalog: Catalog) => {
		const events = new EventEmitter<FSEvents>();
		const fs = { events } as unknown as FileStructure;
		new FSLocalizationEvents(fs).mount();
		await events.emit("catalog-read", { fs, catalog });
	};

	test("убирает непереведённую статью из навигации", async () => {
		const migration = category("docs/en/catalog/migration", [
			article("docs/en/catalog/migration/yandex-wiki"),
			article("docs/en/catalog/migration/notion", "Migrating from Notion"),
		]);
		const catalog = makeCatalog(
			"docs",
			"ru",
			["ru", "en"],
			[
				category("docs/en", [category("docs/en/catalog", [migration], "Catalog")]),
				category("docs/catalog", [
					category("docs/catalog/migration", [
						article("docs/catalog/migration/yandex-wiki", "Yandex Wiki"),
						article("docs/catalog/migration/notion", "Миграция из Notion"),
					]),
				]),
			],
		);

		await readCatalog(catalog);

		expect(logicPaths(migration)).toEqual(["docs/en/catalog/migration/notion"]);
	});

	test("оставляет непереведённую статью в редакторе — там её и переводят", async () => {
		jest.spyOn(env, "getExecutingEnvironment").mockReturnValue("web");

		const migration = category("docs/en/catalog/migration", [article("docs/en/catalog/migration/yandex-wiki")]);
		const catalog = makeCatalog(
			"docs",
			"ru",
			["ru", "en"],
			[
				category("docs/en", [category("docs/en/catalog", [migration], "Catalog")]),
				category("docs/catalog", [
					category("docs/catalog/migration", [article("docs/catalog/migration/yandex-wiki", "Yandex Wiki")]),
				]),
			],
		);

		await readCatalog(catalog);

		expect(logicPaths(migration)).toEqual(["docs/en/catalog/migration/yandex-wiki"]);
		expect(migration.items[0].props.external).toBe("Yandex Wiki");
	});
});

describe("hideUntranslatedItems", () => {
	test("убирает непереведённый раздел целиком", () => {
		const enCatalog = category("docs/en/catalog", [article("docs/en/catalog/versioning")]);
		const enRoot = category("docs/en", [enCatalog]);
		const catalog = makeCatalog("docs", "ru", ["ru", "en"], [enRoot]);
		enCatalog.props.external = "Каталог";
		enCatalog.items[0].props.external = "Версионирование";

		hideUntranslatedItems(catalog);

		expect(logicPaths(enRoot)).toEqual([]);
	});

	test("оставляет непереведённый раздел, если внутри есть перевод", () => {
		const enCatalog = category("docs/en/catalog", [
			article("docs/en/catalog/versioning"),
			article("docs/en/catalog/search", "Search"),
		]);
		const enRoot = category("docs/en", [enCatalog]);
		const catalog = makeCatalog("docs", "ru", ["ru", "en"], [enRoot]);
		enCatalog.props.external = "Каталог";
		enCatalog.items[0].props.external = "Версионирование";

		hideUntranslatedItems(catalog);

		expect(logicPaths(enRoot)).toEqual(["docs/en/catalog"]);
		expect(logicPaths(enCatalog)).toEqual(["docs/en/catalog/search"]);
	});

	test("не трогает основной язык", () => {
		const ruRoot = category("docs/catalog", [article("docs/catalog/versioning")]);
		const catalog = makeCatalog("docs", "ru", ["ru", "en"], [ruRoot]);
		ruRoot.items[0].props.external = "Версионирование";

		hideUntranslatedItems(catalog);

		expect(logicPaths(ruRoot)).toEqual(["docs/catalog/versioning"]);
	});

	test("сбрасывает кэш поиска только когда что-то удалено", () => {
		const enRoot = category("docs/en", [article("docs/en/versioning", "Versioning")]);
		const catalog = makeCatalog("docs", "ru", ["ru", "en"], [enRoot]);
		const resetSearcherCache = jest.spyOn(catalog, "resetSearcherCache");

		hideUntranslatedItems(catalog);
		expect(resetSearcherCache).not.toHaveBeenCalled();

		enRoot.items[0].props.external = "Версионирование";
		hideUntranslatedItems(catalog);
		expect(resetSearcherCache).toHaveBeenCalledTimes(1);
	});
});
