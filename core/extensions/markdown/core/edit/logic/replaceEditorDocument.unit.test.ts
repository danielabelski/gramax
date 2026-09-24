import Comment from "@ext/markdown/elements/comment/edit/model/comment";
import Paragraph from "@ext/markdown/elements/paragraph/edit/model/paragraph";
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";
import replaceEditorDocument from "./replaceEditorDocument";

const documentWithText = (text: string) => ({
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("replaceEditorDocument", () => {
	test("replaces content without emitting an update or preserving article history", () => {
		const onUpdate = jest.fn();
		const editor = new Editor({
			content: documentWithText("first"),
			extensions: [Document, Paragraph, Text, UndoRedo],
			onUpdate,
		});
		editor.commands.insertContent(" changed");
		expect(editor.can().undo()).toBe(true);
		onUpdate.mockClear();

		replaceEditorDocument(editor, documentWithText("second"), { resetCommentBodies: false });

		expect(editor.getText()).toBe("second");
		expect(editor.can().undo()).toBe(false);
		expect(editor.state.selection.from).toBe(1);
		expect(onUpdate).not.toHaveBeenCalled();
		editor.destroy();
	});

	test("ignores an editor that has already been destroyed", () => {
		const editor = new Editor({
			content: documentWithText("first"),
			extensions: [Document, Paragraph, Text],
		});
		editor.destroy();

		expect(() =>
			replaceEditorDocument(editor, documentWithText("second"), { resetCommentBodies: false }),
		).not.toThrow();
	});

	test("resets article-scoped comment storage", () => {
		const editor = new Editor({
			content: documentWithText("first"),
			extensions: [Document, Paragraph, Text, Comment],
		});
		const storage = editor.storage.comment;
		storage.openedComment = { id: "old", position: { from: 1, to: 2 } };
		storage.hoverComment = "old";
		storage.positions.set("old", [{ from: 1, to: 2 }]);
		storage.comments.set("old", {} as never);
		storage.deleted.set("deleted", {} as never);

		replaceEditorDocument(editor, documentWithText("second"), { resetCommentBodies: true });

		expect(storage.openedComment).toBeNull();
		expect(storage.hoverComment).toBeNull();
		expect(storage.positions.size).toBe(0);
		expect(storage.comments.size).toBe(0);
		expect(storage.deleted.size).toBe(0);
		editor.destroy();
	});
});
