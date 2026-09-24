import type { Editor, JSONContent } from "@tiptap/core";
import { useLayoutEffect, useRef } from "react";
import replaceEditorDocument from "./replaceEditorDocument";

const useSyncEditorDocument = (
	editor: Editor | null,
	articleId: string,
	content: string,
	extensions: unknown,
): void => {
	const previous = useRef({ editor, articleId, content, extensions });

	useLayoutEffect(() => {
		if (!editor || editor.isDestroyed) return;
		if (previous.current.extensions !== extensions) {
			previous.current = { editor, articleId, content, extensions };
			return;
		}
		if (previous.current.editor !== editor) {
			previous.current = { editor, articleId, content, extensions };
			return;
		}
		if (previous.current.articleId === articleId && previous.current.content === content) return;

		const articleChanged = previous.current.articleId !== articleId;
		previous.current = { editor, articleId, content, extensions };
		replaceEditorDocument(editor, JSON.parse(content) as JSONContent, {
			resetCommentBodies: articleChanged,
		});
	}, [editor, articleId, content, extensions]);
};

export default useSyncEditorDocument;
