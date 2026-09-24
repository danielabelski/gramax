import Br from "@ext/markdown/elements/br/edit/br";
import HardBreak from "@ext/markdown/elements/br/edit/hardBreak";
import SoftBreak from "@ext/markdown/elements/br/edit/softBreak";
import ExtendedCodeBlockLowlight from "@ext/markdown/elements/codeBlockLowlight/edit/model/codeBlockLowlight";
import CustomBulletList from "@ext/markdown/elements/list/edit/models/bulletList/model/customBulletList";
import CustomListItem from "@ext/markdown/elements/list/edit/models/listItem/model/listItem";
import Paragraph from "@ext/markdown/elements/paragraph/edit/model/paragraph";
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";

const createEditor = (content: object) => {
	const element = document.createElement("div");
	document.body.append(element);
	return new Editor({
		element,
		content,
		extensions: [Document, Paragraph, Text, Br, HardBreak, SoftBreak, CustomBulletList, CustomListItem],
	});
};

const pressEnter = (editor: Editor, modifiers: { shiftKey?: boolean; metaKey?: boolean } = {}) => {
	editor.view.dom.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...modifiers }),
	);
};

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("Shift+Enter", () => {
	test("inserts hard_break inside a paragraph", () => {
		const editor = createEditor({ type: "doc", content: [paragraph("First line.")] });
		editor.commands.focus("end");

		pressEnter(editor, { shiftKey: true });
		editor.commands.insertContent("Second line.");

		const doc = editor.state.doc;
		expect(doc.childCount).toBe(1);
		expect(doc.child(0).type.name).toBe("paragraph");
		expect(editor.getJSON().content[0].content.map((node) => node.type)).toEqual(["text", "hard_break", "text"]);
		editor.destroy();
	});

	test("inserts hard_break inside a list item without creating a new item or paragraph", () => {
		const editor = createEditor({
			type: "doc",
			content: [{ type: "bulletList", content: [{ type: "listItem", content: [paragraph("First line.")] }] }],
		});
		editor.commands.focus("end");

		pressEnter(editor, { shiftKey: true });

		const list = editor.state.doc.child(0);
		expect(list.childCount).toBe(1);
		const item = list.child(0);
		expect(item.childCount).toBe(1);
		expect(item.child(0).type.name).toBe("paragraph");
		expect(item.child(0).lastChild.type.name).toBe("hard_break");
		editor.destroy();
	});
});

describe("Cmd/Ctrl+Enter keeps splitting the block", () => {
	test("splits a paragraph in two", () => {
		const editor = createEditor({ type: "doc", content: [paragraph("First line.")] });
		editor.commands.focus("end");

		pressEnter(editor, { metaKey: true });

		expect(editor.state.doc.childCount).toBe(2);
		expect(editor.state.doc.child(1).type.name).toBe("paragraph");
		editor.destroy();
	});

	test("adds a second paragraph inside the same list item", () => {
		const editor = createEditor({
			type: "doc",
			content: [{ type: "bulletList", content: [{ type: "listItem", content: [paragraph("First line.")] }] }],
		});
		editor.commands.focus("end");

		pressEnter(editor, { metaKey: true });

		const list = editor.state.doc.child(0);
		expect(list.childCount).toBe(1);
		expect(list.child(0).childCount).toBe(2);
		expect(list.child(0).child(1).type.name).toBe("paragraph");
		editor.destroy();
	});
});

describe("Shift+Enter in a code block", () => {
	test("inserts a plain newline", () => {
		const element = document.createElement("div");
		document.body.append(element);
		const editor = new Editor({
			element,
			content: {
				type: "doc",
				content: [{ type: "code_block", content: [{ type: "text", text: "code" }] }],
			},
			extensions: [Document, Paragraph, Text, Br, HardBreak, SoftBreak, ExtendedCodeBlockLowlight],
		});
		editor.commands.focus("end");

		pressEnter(editor, { shiftKey: true });

		expect(editor.state.doc.child(0).textContent).toBe("code\n");
		editor.destroy();
	});
});
