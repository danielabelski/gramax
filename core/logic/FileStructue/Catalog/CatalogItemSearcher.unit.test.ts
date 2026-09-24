import Path from "@core/FileProvider/Path/Path";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import { CatalogItemSearcher } from "@core/FileStructue/Catalog/CatalogItemSearcher";
import type { Category } from "@core/FileStructue/Category/Category";
import type { Item } from "@core/FileStructue/Item/Item";
import { ItemType } from "@core/FileStructue/Item/ItemType";

type TestCategory = Category & { items: Item[] };

const article = (path: string, logicPath: string, parent?: TestCategory): Item =>
	({
		type: ItemType.article,
		logicPath,
		ref: { path: new Path(path), storageId: "test" },
		parent,
	}) as Item;

const category = (path: string, logicPath: string, items: Item[] = [], parent?: TestCategory): TestCategory => {
	const result = {
		type: ItemType.category,
		logicPath,
		ref: { path: new Path(path), storageId: "test" },
		parent,
		items,
	} as TestCategory;
	for (const item of items) item.parent = result;
	return result;
};

describe("CatalogItemSearcher", () => {
	test("finds items by physical and logic paths", () => {
		const guide = category("catalog/guide/_index.md", "guide");
		const install = article("catalog/guide/install.md", "guide/install", guide);
		guide.items.push(install);
		const root = category("catalog/_index.md", "", [guide]);
		const searcher = createSearcher(root);

		expect(searcher.findItemByPath(new Path("catalog/guide/install.md"))).toBe(install);
		expect(searcher.findItemByLogicPath(root, "guide/install")).toBe(install);
		expect(searcher.findItemByPath(new Path("catalog/guide/_index.md"), ItemType.article)).toBeNull();
	});

	test("respects a logic-path subtree root", () => {
		const first = category("catalog/first/_index.md", "first", [article("catalog/first/page.md", "shared")]);
		const secondPage = article("catalog/second/page.md", "second/page");
		const second = category("catalog/second/_index.md", "second", [secondPage]);
		const root = category("catalog/_index.md", "", [first, second]);
		const searcher = createSearcher(root);

		expect(searcher.findItemByLogicPath(second, "shared")).toBeNull();
		expect(searcher.findItemByLogicPath(second, "second/page")).toBe(secondPage);
	});

	test("rebuilds indexes after a partial cache reset", () => {
		const oldItem = article("catalog/old.md", "old");
		const root = category("catalog/_index.md", "", [oldItem]);
		const searcher = createSearcher(root);
		expect(searcher.findItemByPath(oldItem.ref.path)).toBe(oldItem);

		const newItem = article("catalog/new.md", "new", root);
		root.items.splice(0, 1, newItem);
		searcher.resetCache([oldItem.ref.path.value]);

		expect(searcher.findItemByPath(oldItem.ref.path)).toBeNull();
		expect(searcher.findItemByPath(newItem.ref.path)).toBe(newItem);
		expect(searcher.findItemByLogicPath(root, "new")).toBe(newItem);
	});

	test("traverses the catalog only once for many different misses", () => {
		let itemReads = 0;
		const root = category("catalog/_index.md", "");
		Object.defineProperty(root, "items", {
			get: () => {
				itemReads++;
				return [];
			},
		});
		const searcher = createSearcher(root);

		for (let index = 0; index < 100; index++) {
			expect(searcher.findItemByPath(new Path(`catalog/missing-${index}.md`))).toBeNull();
		}

		expect(itemReads).toBe(1);
	});

	test("indexes items without retaining strong references", () => {
		const page = article("catalog/page.md", "page");
		const root = category("catalog/_index.md", "", [page]);
		const searcher = createSearcher(root);

		searcher.findItemByPath(page.ref.path);

		const indexes = searcher as unknown as {
			// biome-ignore lint/style/useNamingConvention: accesses a private index to verify its reference type
			_itemPathIndex: Map<string, WeakRef<Item>>;
			// biome-ignore lint/style/useNamingConvention: accesses a private index to verify its reference type
			_logicPathIndex: Map<string, WeakRef<Item>[]>;
		};
		expect(indexes._itemPathIndex.get("catalog/page.md")).toBeInstanceOf(WeakRef);
		expect(indexes._logicPathIndex.get("page")?.[0]).toBeInstanceOf(WeakRef);
	});

	test("applies filters and returns their error article", () => {
		const hidden = article("catalog/hidden.md", "hidden");
		const fallback = article("catalog/denied.md", "denied");
		const root = category("catalog/_index.md", "", [hidden]);
		const searcher = createSearcher(root);
		const filter = Object.assign(() => false, { getErrorArticle: () => fallback });

		expect(searcher.findItemByLogicPath(root, "hidden", [filter])).toBe(fallback);
	});

	test("returns an error article for a missing path below a rejected category", () => {
		const privateCategory = category("catalog/private/_index.md", "private");
		const fallback = article("catalog/denied.md", "denied");
		const root = category("catalog/_index.md", "", [privateCategory]);
		const searcher = createSearcher(root);
		const filter = Object.assign((item: Item) => item !== privateCategory, { getErrorArticle: () => fallback });

		expect(searcher.findItemByLogicPath(root, "private/missing", [filter])).toBe(fallback);
	});
});

function createSearcher(root: TestCategory): CatalogItemSearcher {
	return new CatalogItemSearcher({ getRootCategory: () => root } as Catalog);
}
