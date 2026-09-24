import type { MouseEvent } from "react";

const isModifiedClick = (e: MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;

export const searchLinkClick = (open: () => void) => (e: MouseEvent) => {
	if (e.defaultPrevented || isModifiedClick(e)) return;
	e.preventDefault();
	open();
};
