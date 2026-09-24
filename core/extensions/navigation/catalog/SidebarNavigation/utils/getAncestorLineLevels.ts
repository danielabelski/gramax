import type { NavigationTreeStore } from "../store/navigationTreeStore";

export const getAncestorLineLevels = (id: string, level: number, state: NavigationTreeStore): number[] => {
	const { parentMap, childrenMap, rootIds, hoveredParentId, hoveredAnchorId, dragLineIds } = state;
	const siblings = hoveredParentId && !rootIds.includes(hoveredParentId) ? childrenMap[hoveredParentId] : undefined;
	const anchorIndex = siblings?.indexOf(hoveredAnchorId) ?? -1;
	const levels: number[] = [];
	let ancestor = parentMap[id];
	for (let depth = level - 1; ancestor && depth > 1; depth--) {
		const siblingIndex = siblings?.indexOf(ancestor) ?? -1;
		if (dragLineIds.has(ancestor) || (siblingIndex >= 0 && siblingIndex <= anchorIndex)) levels.push(depth);
		ancestor = parentMap[ancestor];
	}
	return levels;
};
