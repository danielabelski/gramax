import type { WorkspaceLayoutItem } from "@ext/workspace/WorkspaceConfig";
import { layoutItemId } from "./workspaceLayout";

const retainHidden = (item: WorkspaceLayoutItem, visibleCatalogs: Set<string>): WorkspaceLayoutItem | null => {
	if (item.type === "catalog") return visibleCatalogs.has(item.name) ? null : item;
	const items = item.items
		.map((child) => retainHidden(child, visibleCatalogs))
		.filter((child): child is WorkspaceLayoutItem => child !== null);
	return items.length ? { ...item, items } : null;
};

/** Keeps items unavailable to the saving user at their previous sibling positions. */
export const mergeLayoutItems = (
	previous: WorkspaceLayoutItem[],
	next: WorkspaceLayoutItem[],
	seen: string[],
): WorkspaceLayoutItem[] => {
	const visibleCatalogs = new Set(seen);
	const previousById = new Map(previous.map((item) => [layoutItemId(item), item]));
	const result = next.map((item) => {
		if (item.type === "catalog") return item;
		const old = previousById.get(layoutItemId(item));
		return old?.type === "section" ? { ...item, items: mergeLayoutItems(old.items, item.items, seen) } : item;
	});

	let anchor = -1;
	for (const old of previous) {
		const id = layoutItemId(old);
		const at = result.findIndex((item) => layoutItemId(item) === id);
		if (at !== -1) {
			anchor = at;
			continue;
		}
		const hidden = retainHidden(old, visibleCatalogs);
		if (hidden) result.splice(++anchor, 0, hidden);
	}

	return result;
};
