const isScrollable = (element: HTMLElement) => {
	const { overflowY } = getComputedStyle(element);
	return overflowY === "auto" || overflowY === "scroll";
};

/** Nearest scrollable ancestor — the element the publish tree is virtualized against. */
export const findScrollParent = (node: HTMLElement): HTMLElement => {
	let parent = node?.parentElement;

	while (parent) {
		if (isScrollable(parent)) return parent;
		parent = parent.parentElement;
	}

	return document.documentElement;
};
