import type { CommentBlock } from "@core-ui/CommentBlock";
import Comment from "@ext/markdown/elements/comment/edit/model/comment";
import Paragraph from "@ext/markdown/elements/paragraph/edit/model/paragraph";
import { renderHook } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import useSyncEditorDocument from "./useSyncEditorDocument";

const documentWithText = (text: string) => ({
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const commentBody: CommentBlock = {
	comment: {
		dateTime: "2026-08-31",
		content: [{ type: "text", text: "body" }],
		user: { mail: "author@example.com", name: "Author" },
	},
	answers: [],
};

describe("useSyncEditorDocument", () => {
	test("keeps the editor instance and replaces its document when article content changes", () => {
		const extensions = {};
		const editor = new Editor({
			content: documentWithText("first"),
			extensions: [Document, Paragraph, Text],
		});
		const view = renderHook(
			({ articleId, content }) => useSyncEditorDocument(editor, articleId, content, extensions),
			{
				initialProps: { articleId: "first.md", content: JSON.stringify(documentWithText("first")) },
			},
		);

		view.rerender({ articleId: "second.md", content: JSON.stringify(documentWithText("second")) });

		expect(editor.getText()).toBe("second");
		expect(editor.isDestroyed).toBe(false);
		editor.destroy();
	});

	test("replaces a dirty document when navigating to an article with the same source content", () => {
		const extensions = {};
		const source = JSON.stringify(documentWithText("same source"));
		const editor = new Editor({
			content: source,
			extensions: [Document, Paragraph, Text],
		});
		const view = renderHook(({ articleId }) => useSyncEditorDocument(editor, articleId, source, extensions), {
			initialProps: { articleId: "first.md" },
		});
		editor.commands.insertContent(" dirty");

		view.rerender({ articleId: "second.md" });

		expect(editor.getText()).toBe("same source");
		editor.destroy();
	});

	test("preserves loaded comment bodies when the current article content refreshes", () => {
		const extensions = {};
		const editor = new Editor({
			content: documentWithText("first"),
			extensions: [Document, Paragraph, Text, Comment],
		});
		editor.storage.comment.comments.set("1", commentBody);
		editor.storage.comment.deleted.set("deleted", commentBody);
		const view = renderHook(({ content }) => useSyncEditorDocument(editor, "article.md", content, extensions), {
			initialProps: { content: JSON.stringify(documentWithText("first")) },
		});

		view.rerender({ content: JSON.stringify(documentWithText("second")) });

		expect(editor.storage.comment.comments.get("1")).toBe(commentBody);
		expect(editor.storage.comment.deleted.get("deleted")).toBe(commentBody);
		editor.destroy();
	});

	test("clears comment bodies when the editor switches to another article", () => {
		const extensions = {};
		const editor = new Editor({
			content: documentWithText("first"),
			extensions: [Document, Paragraph, Text, Comment],
		});
		editor.storage.comment.comments.set("1", commentBody);
		editor.storage.comment.deleted.set("deleted", commentBody);
		const view = renderHook(
			({ articleId, content }) => useSyncEditorDocument(editor, articleId, content, extensions),
			{
				initialProps: { articleId: "first.md", content: JSON.stringify(documentWithText("first")) },
			},
		);

		view.rerender({ articleId: "second.md", content: JSON.stringify(documentWithText("second")) });

		expect(editor.storage.comment.comments.size).toBe(0);
		expect(editor.storage.comment.deleted.size).toBe(0);
		editor.destroy();
	});
});
