import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { createItemLinksStore, shouldReplaceItemLinks } from "./ItemLinksStore";

const mkRef = (path: string, storageId = "storage-1") => ({ path, storageId });

const mkLink = (path: string, title: string, items?: ItemLink[], storageId = "storage-1"): ItemLink =>
	({ ref: mkRef(path, storageId), title, items }) as unknown as ItemLink;

describe("ItemLinksStore", () => {
	test("setItemLinks replaces the tree", () => {
		const store = createItemLinksStore();
		store.getState().setItemLinks([mkLink("a.md", "A")]);
		expect(store.getState().itemLinks).toHaveLength(1);
	});

	test("patchItemProps updates matching top-level link title", () => {
		const store = createItemLinksStore({ itemLinks: [mkLink("a.md", "A"), mkLink("b.md", "B")] });
		store.getState().patchItemProps([{ ref: mkRef("a.md"), props: { title: "A-new" } }]);
		const links = store.getState().itemLinks;
		expect(links[0].title).toBe("A-new");
		expect(links[1].title).toBe("B");
	});

	test("patchItemProps recurses into nested items", () => {
		const store = createItemLinksStore({
			itemLinks: [mkLink("root.md", "Root", [mkLink("nested.md", "Nested")])],
		});
		store.getState().patchItemProps([{ ref: mkRef("nested.md"), props: { title: "Nested-new" } }]);
		const links = store.getState().itemLinks;
		expect((links[0] as unknown as { items: ItemLink[] }).items[0].title).toBe("Nested-new");
	});

	test("patchItemProps returns identical reference when no match", () => {
		const initial: ItemLink[] = [mkLink("a.md", "A")];
		const store = createItemLinksStore({ itemLinks: initial });
		store.getState().patchItemProps([{ ref: mkRef("nonexistent.md"), props: { title: "X" } }]);
		expect(store.getState().itemLinks).toBe(initial);
	});

	test("patchItemProps no-ops on empty patches", () => {
		const initial: ItemLink[] = [mkLink("a.md", "A")];
		const store = createItemLinksStore({ itemLinks: initial });
		store.getState().patchItemProps([]);
		expect(store.getState().itemLinks).toBe(initial);
	});

	test("patchItemProps leaves the same path in another workspace alone", () => {
		const initial: ItemLink[] = [mkLink("untitled.md", "Mine")];
		const store = createItemLinksStore({ itemLinks: initial });
		store.getState().patchItemProps([{ ref: mkRef("untitled.md", "storage-2"), props: { title: "Theirs" } }]);
		expect(store.getState().itemLinks).toBe(initial);
	});

	test("patchItemProps applies a patch that names the link's own workspace", () => {
		const store = createItemLinksStore({ itemLinks: [mkLink("untitled.md", "Mine")] });
		store.getState().patchItemProps([{ ref: mkRef("untitled.md"), props: { title: "Renamed" } }]);
		expect(store.getState().itemLinks[0].title).toBe("Renamed");
	});

	test("patchItemProps preserves unchanged sibling references", () => {
		const sibling = mkLink("b.md", "B");
		const store = createItemLinksStore({ itemLinks: [mkLink("a.md", "A"), sibling] });
		store.getState().patchItemProps([{ ref: mkRef("a.md"), props: { title: "A-new" } }]);
		const links = store.getState().itemLinks;
		expect(links[1]).toBe(sibling);
	});
});

describe("shouldReplaceItemLinks", () => {
	const a = [mkLink("a.md", "A")];

	test("empty incoming never wipes a populated tree", () => {
		expect(shouldReplaceItemLinks([], a)).toBe(false);
	});

	test("non-empty incoming replaces", () => {
		expect(shouldReplaceItemLinks(a, [])).toBe(true);
		expect(shouldReplaceItemLinks(a, [mkLink("b.md", "B")])).toBe(true);
	});

	test("empty incoming allowed only when store already empty", () => {
		expect(shouldReplaceItemLinks([], [])).toBe(true);
	});
	describe("renameLink", () => {
		const section = (path: string, pathname: string, title: string, items: ItemLink[]): ItemLink =>
			({ ref: mkRef(path), pathname, title, items }) as unknown as ItemLink;
		const leaf = (path: string, pathname: string, title: string): ItemLink =>
			({ ref: mkRef(path), pathname, title }) as unknown as ItemLink;
		const move = { ref: mkRef("cat/alpha/_index.md"), pathname: "/cat/alpha", title: "Alpha" };

		test("moves the section and every descendant under its new folder", () => {
			const store = createItemLinksStore({
				itemLinks: [
					section("cat/untitled/_index.md", "/cat/untitled", "Untitled", [
						leaf("cat/untitled/child.md", "/cat/untitled/child", "Child"),
						section("cat/untitled/deep/_index.md", "/cat/untitled/deep", "Deep", [
							leaf("cat/untitled/deep/leaf.md", "/cat/untitled/deep/leaf", "Leaf"),
						]),
					]),
				],
			});

			store.getState().renameLink(mkRef("cat/untitled/_index.md"), move);

			const [renamed] = store.getState().itemLinks as unknown as (ItemLink & { items: ItemLink[] })[];
			expect(renamed.title).toBe("Alpha");
			expect(renamed.ref.path).toBe("cat/alpha/_index.md");
			expect(renamed.pathname).toBe("/cat/alpha");
			expect(renamed.items[0].ref.path).toBe("cat/alpha/child.md");
			expect(renamed.items[0].pathname).toBe("/cat/alpha/child");
			const deep = renamed.items[1] as ItemLink & { items: ItemLink[] };
			expect(deep.ref.path).toBe("cat/alpha/deep/_index.md");
			expect(deep.items[0].ref.path).toBe("cat/alpha/deep/leaf.md");
			expect(deep.items[0].pathname).toBe("/cat/alpha/deep/leaf");
		});

		test("renames an article without touching its siblings", () => {
			const sibling = leaf("cat/b.md", "/cat/b", "B");
			const store = createItemLinksStore({
				itemLinks: [leaf("cat/untitled.md", "/cat/untitled", "Untitled"), sibling],
			});

			store.getState().renameLink(mkRef("cat/untitled.md"), {
				ref: mkRef("cat/alpha.md"),
				pathname: "/cat/alpha",
				title: "Alpha",
			});

			const links = store.getState().itemLinks;
			expect(links[0].ref.path).toBe("cat/alpha.md");
			expect(links[0].title).toBe("Alpha");
			expect(links[1]).toBe(sibling);
		});

		test("leaves a tree that already holds the new ref alone: the path was reused by a newer article", () => {
			const initial = [
				leaf("cat/alpha.md", "/cat/alpha", "Alpha"),
				leaf("cat/untitled.md", "/cat/untitled", "Untitled"),
			];
			const store = createItemLinksStore({ itemLinks: initial });

			store.getState().renameLink(mkRef("cat/untitled.md"), {
				ref: mkRef("cat/alpha.md"),
				pathname: "/cat/alpha",
				title: "Alpha",
			});

			expect(store.getState().itemLinks).toBe(initial);
		});

		test("a title-only rename still retitles the link: the file did not move", () => {
			const store = createItemLinksStore({ itemLinks: [leaf("cat/untitled.md", "/cat/untitled", "Untitled")] });

			store.getState().renameLink(mkRef("cat/untitled.md"), {
				ref: mkRef("cat/untitled.md"),
				pathname: "/cat/untitled",
				title: "UNTITLED",
			});

			expect(store.getState().itemLinks[0].title).toBe("UNTITLED");
		});

		test("returns the same tree when nothing matches", () => {
			const initial = [leaf("cat/a.md", "/cat/a", "A")];
			const store = createItemLinksStore({ itemLinks: initial });

			store.getState().renameLink(mkRef("cat/gone.md"), {
				ref: mkRef("cat/alpha.md"),
				pathname: "/cat/alpha",
				title: "Alpha",
			});

			expect(store.getState().itemLinks).toBe(initial);
		});
	});
});
