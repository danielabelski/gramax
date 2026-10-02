import Path from "@core/FileProvider/Path/Path";
import remove from "./remove";

type RemoveArgs = Parameters<typeof remove.do>[0];
type MockItem = { key: string; parent?: MockItem };

const root: MockItem = { key: "." };
const section: MockItem = { key: "section/_index.md", parent: root };
const first: MockItem = { key: "section/first.md", parent: section };
const second: MockItem = { key: "section/second.md", parent: section };
const third: MockItem = { key: "section/third.md", parent: section };

const items: Record<string, MockItem> = Object.fromEntries(
	[section, first, second, third].map((item) => [item.key, item]),
);
const children = new Map<MockItem, MockItem[]>([
	[root, [section]],
	[section, [first, second, third]],
]);
const pathname = (item: MockItem) =>
	item === root ? "catalog" : `catalog/-/${item.key.replace(/(\/_index)?\.md$/, "")}`;

describe("item/remove redirect", () => {
	let deleteItem: jest.Mock;

	const runRemove = (path: string, currentArticlePath: string) => {
		deleteItem = jest.fn();
		const catalog = {
			findItemByItemPath: (p: Path) => items[p.value],
			getCategoryItems: (category: MockItem) => children.get(category) ?? [],
			getPathname: async (item: MockItem) => pathname(item),
			deleteItem,
		};
		Reflect.set(remove, "_app", {
			wm: {
				current: () => ({
					getCatalog: async () => catalog,
					getFileProvider: () => ({ getItemRef: (p: Path) => ({ path: p }) }),
				}),
			},
			parser: null,
			parserContextFactory: null,
		});

		return remove.do({
			ctx: null as unknown as RemoveArgs["ctx"],
			catalogName: "catalog",
			path: new Path(path),
			currentArticlePath: new Path(currentArticlePath),
		});
	};

	it("redirects to the sibling above when the open article is removed", async () => {
		expect(await runRemove("section/third.md", "section/third.md")).toBe("catalog/-/section/second");
		expect(deleteItem).toHaveBeenCalled();
	});

	it("redirects to the sibling above from the middle of the list", async () => {
		expect(await runRemove("section/second.md", "section/second.md")).toBe("catalog/-/section/first");
	});

	it("redirects to the parent when the removed open article is the first one", async () => {
		expect(await runRemove("section/first.md", "section/first.md")).toBe("catalog/-/section");
	});

	it("keeps the open article when another article is removed", async () => {
		expect(await runRemove("section/second.md", "section/third.md")).toBe("catalog/-/section/third");
	});
});
