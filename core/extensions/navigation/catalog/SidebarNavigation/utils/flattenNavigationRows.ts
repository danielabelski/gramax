import type { ChildrenMap } from "../store/navigationTreeStore";

export type NavigationRow = { id: string; level: number; groupId: string };

export const flattenNavigationRows = (
	rootIds: string[],
	childrenMap: ChildrenMap,
	expanded: ReadonlySet<string>,
): NavigationRow[] => {
	const rows: NavigationRow[] = [];
	const pending = rootIds.map((id) => ({ id, level: 1, groupId: id })).reverse();
	while (pending.length) {
		const row = pending.pop()!;
		rows.push(row);
		if (!expanded.has(row.id)) continue;
		const children = childrenMap[row.id] ?? [];
		for (let index = children.length - 1; index >= 0; index--) {
			pending.push({ id: children[index], level: row.level + 1, groupId: row.groupId });
		}
	}
	return rows;
};
