import type { Editor } from "@tiptap/core";

export const ARTICLE_POPOVER_PADDING = {
	bottom: 56,
	left: 48,
	right: 48,
	top: 48,
} as const;

export const getArticlePopoverContainer = (editor: Editor, container?: HTMLElement | null): HTMLElement =>
	container ?? editor.view.dom.parentElement ?? document.body;

export const getArticlePopoverBoundary = <T>(
	editor: Editor,
	boundary: HTMLElement | null | undefined,
	fallback: T,
): HTMLElement | T => boundary ?? editor.view.dom.closest<HTMLElement>(".article-content-wrapper") ?? fallback;
