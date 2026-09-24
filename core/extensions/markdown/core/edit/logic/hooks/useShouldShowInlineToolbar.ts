import useMediaQuery from "@core-ui/hooks/useMediaQuery";
import { cssMedia } from "@core-ui/utils/cssUtils";
import type { Editor } from "@tiptap/core";
import { CellSelection } from "prosemirror-tables";
import { useCallback } from "react";

export const shouldShowInlineToolbar = (editor: Editor, isMobile: boolean) => {
	if (!editor.isEditable || isMobile) return false;

	const { from, to, empty } = editor.state.selection;
	if (empty) return false;

	const text = !!editor.state.doc.textBetween(from, to);
	const isCellSelection = editor.state.selection instanceof CellSelection;

	if ((!text && !isCellSelection) || editor.state.doc.firstChild === editor.state.selection.$from.parent) {
		return false;
	}

	// Code blocks hold plain text, so no inline mark applies — hide the whole toolbar
	// instead of leaving a few actions that mangle code-block content.
	if (editor.state.selection.$from.parent.type.name === "code_block") return false;

	return true;
};

export const useShouldShowInlineToolbar = () => {
	const isMobile = useMediaQuery(cssMedia.JSnarrow);

	return useCallback(({ editor }: { editor: Editor }) => shouldShowInlineToolbar(editor, isMobile), [isMobile]);
};
