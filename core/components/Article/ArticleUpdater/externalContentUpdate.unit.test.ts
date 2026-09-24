import Paragraph from "@ext/markdown/elements/paragraph/edit/model/paragraph";
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";

// A page read puts its content into the open editor. Tiptap emits `update` for that by default,
// the app cannot tell it from typing, and saves it back — over the write that prompted the read.
// That is what loses local changes across a branch checkout.

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

const createEditor = () => {
	const element = document.createElement("div");
	document.body.append(element);
	return new Editor({ element, content: doc("before"), extensions: [Document, Paragraph, Text] });
};

describe("An external content update", () => {
	test("replaces the document", () => {
		const editor = createEditor();

		editor.chain().setContent(doc("after"), { emitUpdate: false }).run();

		expect(editor.state.doc.textContent).toBe("after");
	});

	test("does not look like user input", () => {
		const editor = createEditor();
		const onUpdate = jest.fn();
		editor.on("update", onUpdate);

		editor.chain().setContent(doc("after"), { emitUpdate: false }).run();

		expect(onUpdate).not.toHaveBeenCalled();
	});

	test("would look like user input without the option", () => {
		const editor = createEditor();
		const onUpdate = jest.fn();
		editor.on("update", onUpdate);

		editor.chain().setContent(doc("after")).run();

		expect(onUpdate).toHaveBeenCalled();
	});
});
