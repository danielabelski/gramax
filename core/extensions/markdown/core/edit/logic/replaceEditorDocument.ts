import { processCommentPositions } from "@ext/markdown/elements/comment/edit/logic/utils/StateWatcher";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";

interface ReplaceEditorDocumentOptions {
	resetCommentBodies: boolean;
}

const replaceEditorDocument = (
	editor: Editor | null,
	content: JSONContent,
	options: ReplaceEditorDocumentOptions,
): void => {
	if (!editor || editor.isDestroyed) return;

	const doc = editor.schema.nodeFromJSON(content);
	const state = EditorState.create({
		doc,
		plugins: editor.state.plugins,
		schema: editor.schema,
	});
	const commentStorage = editor.storage.comment;
	if (commentStorage) {
		commentStorage.openedComment = null;
		commentStorage.hoverComment = null;
		commentStorage.positions = processCommentPositions(doc);
		if (options.resetCommentBodies) {
			commentStorage.comments = new Map();
			commentStorage.deleted = new Map();
		}
	}

	editor.view.updateState(state);
	editor.view.dispatch(editor.state.tr.setMeta("article-document-replaced", true));
};

export default replaceEditorDocument;
