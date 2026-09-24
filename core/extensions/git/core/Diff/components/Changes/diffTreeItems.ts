import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import type { DiffFlattenTreeAnyItem } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import type { TreeItem } from "@ui-kit/Tree";

const STATUS_COLORS: Partial<Record<FileStatus, string>> = {
	[FileStatus.new]: "var(--color-status-new)",
	[FileStatus.delete]: "var(--color-status-deleted)",
	[FileStatus.modified]: "var(--color-status-modified)",
	[FileStatus.rename]: "var(--color-status-rename)",
};

export interface DiffTreeItem extends TreeItem {
	title: string;
	variant: "item" | "group";
	entry: DiffFlattenTreeAnyItem;
	icon?: IconCode;
	accentColor?: string;
	children?: DiffTreeItem[];
}

export type DiffTreeItems = {
	items: DiffTreeItem[];
	entriesById: Map<string, DiffFlattenTreeAnyItem>;
};

const getEntryId = (entry: DiffFlattenTreeAnyItem, index: number) =>
	entry.type === "node" ? `node:${entry.logicpath}:${index}` : entry.filepath.new;

const toTreeItem = (entry: DiffFlattenTreeAnyItem, id: string): DiffTreeItem => {
	if (entry.type === "node")
		return {
			id,
			title: entry.breadcrumbs.map((breadcrumb) => breadcrumb.name).join(" / "),
			variant: "group",
			entry,
		};

	return {
		id,
		title: entry.name,
		variant: "item",
		entry,
		icon: entry.type === "resource" ? (entry.icon as IconCode) : undefined,
		accentColor: STATUS_COLORS[entry.overview.status],
	};
};

/** Turns flat diff entries carrying their own `indent` into nested tree items. */
export const buildDiffTreeItems = (entries: DiffFlattenTreeAnyItem[]): DiffTreeItems => {
	const items: DiffTreeItem[] = [];
	const entriesById = new Map<string, DiffFlattenTreeAnyItem>();
	const parents: { indent: number; item: DiffTreeItem }[] = [];

	entries.forEach((entry, index) => {
		if (entry.type === "node" && !entry.hasChilds) return;

		const id = getEntryId(entry, index);
		const item = toTreeItem(entry, id);
		entriesById.set(id, entry);

		while (parents.length > 0 && parents[parents.length - 1].indent >= entry.indent) parents.pop();

		const parent = parents[parents.length - 1]?.item;
		if (parent) parent.children = [...(parent.children ?? []), item];
		else items.push(item);

		parents.push({ indent: entry.indent, item });
	});

	return { items, entriesById };
};
