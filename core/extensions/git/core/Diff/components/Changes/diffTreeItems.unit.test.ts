import type {
	DiffFlattenTreeAnyItem,
	DiffFlattenTreeItem,
	DiffFlattenTreeNode,
} from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import { buildDiffTreeItems } from "./diffTreeItems";

const node = (logicpath: string, indent: number, hasChilds = true): DiffFlattenTreeNode => ({
	type: "node",
	logicpath,
	indent,
	hasChilds,
	breadcrumbs: [{ name: logicpath, link: "", path: logicpath }],
});

const item = (path: string, indent: number): DiffFlattenTreeItem =>
	({
		type: "item",
		name: path,
		pathname: path,
		logicpath: path,
		filepath: { new: path, old: path },
		overview: { added: 1, removed: 2, isLfs: false, size: 3, status: FileStatus.modified },
		isChanged: true,
		resources: [],
		indent,
		hasChilds: false,
	}) as DiffFlattenTreeItem;

describe("buildDiffTreeItems", () => {
	it("builds nesting from indent values and indexes source entries by row id", () => {
		const group = node("docs", 0);
		const child = item("docs/child.md", 1);
		const sibling = item("readme.md", 0);

		const result = buildDiffTreeItems([group, child, sibling]);

		expect(result.items).toHaveLength(2);
		expect(result.items[0]).toMatchObject({
			id: "node:docs:0",
			title: "docs",
			variant: "group",
			children: [{ id: "docs/child.md", title: "docs/child.md" }],
		});
		expect(result.items[1]).toMatchObject({ id: "readme.md", title: "readme.md", entry: sibling });
		expect(result.entriesById.get("docs/child.md")).toBe(child);
	});

	it("omits empty structural nodes", () => {
		const result = buildDiffTreeItems([node("empty", 0, false) as DiffFlattenTreeAnyItem]);

		expect(result.items).toEqual([]);
		expect(result.entriesById.size).toBe(0);
	});
});
