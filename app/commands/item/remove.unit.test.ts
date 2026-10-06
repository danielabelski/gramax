import Path from "@core/FileProvider/Path/Path";
import remove from "./remove";

type RemoveArgs = Parameters<typeof remove.do>[0];
type MockItem = { key: string; parent?: MockItem };

const root: MockItem = { key: "." };
const section: MockItem = { key: "section/_index.md", parent: root };
const first: MockItem = { key: "section/first.md", parent: section };
const second: MockItem = { key: "section/second.md", parent: section };
const third: MockItem = { key: "section/third.md", parent: section };
const positioning: MockItem = { key: "positioning/_index.md", parent: root };
const writers: MockItem = { key: "positioning/technical-writers/_index.md", parent: positioning };
const messaging: MockItem = { key: "positioning/technical-writers/messaging.md", parent: writers };
const other: MockItem = { key: "other.md", parent: root };

const items: Record<string, MockItem> = Object.fromEntries(
	[section, first, second, third, positioning, writers, messaging, other].map((item) => [item.key, item]),
);
const children = new Map<MockItem, MockItem[]>([
	[root, [section, positioning, other]],
	[section, [first, second, third]],
	[positioning, [writers]],
	[writers, [messaging]],
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

	it("redirects away when the open article lies inside the removed section", async () => {
		const redirect = await runRemove("positioning/_index.md", "positioning/technical-writers/messaging.md");

		expect(redirect).toBe("catalog/-/section");
		expect(deleteItem).toHaveBeenCalled();
	});

	it("redirects away when the open article is the removed section itself", async () => {
		expect(await runRemove("positioning/_index.md", "positioning/_index.md")).toBe("catalog/-/section");
	});

	it("redirects away when a nested section inside the removed one is open", async () => {
		expect(await runRemove("positioning/_index.md", "positioning/technical-writers/_index.md")).toBe(
			"catalog/-/section",
		);
	});

	it("redirects to the parent when the removed section holding the open article is the first one", async () => {
		expect(await runRemove("section/_index.md", "section/second.md")).toBe("catalog");
	});

	it("keeps the open article when it lies outside the removed section", async () => {
		expect(await runRemove("positioning/_index.md", "other.md")).toBe("catalog/-/other");
	});

	it("keeps the open article when an article outside its section is removed", async () => {
		expect(await runRemove("other.md", "positioning/technical-writers/messaging.md")).toBe(
			"catalog/-/positioning/technical-writers/messaging",
		);
	});
});
