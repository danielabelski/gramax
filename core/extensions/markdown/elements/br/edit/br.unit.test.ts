import Br from "@ext/markdown/elements/br/edit/br";
import HardBreak from "@ext/markdown/elements/br/edit/hardBreak";
import Heading from "@ext/markdown/elements/heading/edit/model/heading";
import Paragraph from "@ext/markdown/elements/paragraph/edit/model/paragraph";
import { Editor, Extension } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { Plugin, PluginKey } from "prosemirror-state";

// ProseMirror keeps walking the remaining plugins when a handleKeyDown returns a falsy value, so a
// handler that splits the block but reports nothing lets the next one act on the same keydown too.
// This extension stands in for that next handler: it must never see a key the break plugins took.
const trailingKeyDownProbe = (seen: KeyboardEvent[]) =>
	Extension.create({
		name: "trailingKeyDownProbe",
		priority: 1,

		addProseMirrorPlugins() {
			return [
				new Plugin({
					key: new PluginKey("trailingKeyDownProbe"),
					props: {
						handleKeyDown: (_view, event) => {
							seen.push(event);
							return false;
						},
					},
				}),
			];
		},
	});

const pressEnter = (modifier: "shiftKey" | "metaKey", block: object) => {
	const seen: KeyboardEvent[] = [];
	const element = document.createElement("div");
	document.body.append(element);

	const editor = new Editor({
		element,
		content: { type: "doc", content: [block] },
		extensions: [Document, Paragraph, Heading, Text, Br, HardBreak, trailingKeyDownProbe(seen)],
	});
	editor.commands.focus("end");

	editor.view.dom.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, [modifier]: true, bubbles: true, cancelable: true }),
	);

	const blocks = editor.state.doc.childCount;
	editor.destroy();

	return { blocks, seenByTrailingPlugin: seen.length };
};

const paragraph = { type: "paragraph", content: [{ type: "text", text: "line" }] };
const heading = { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "line" }] };

describe("Line break plugins report the keys they handle", () => {
	test("Mod+Enter splits the block and stops there", () => {
		expect(pressEnter("metaKey", paragraph)).toEqual({ blocks: 2, seenByTrailingPlugin: 0 });
	});

	// Inside a paragraph Shift+Enter is taken by the hard_break branch, which already reports the key;
	// the split is the fallback for every other block, and it is the branch that used to stay silent.
	test("Shift+Enter splits a block that takes no hard break and stops there", () => {
		expect(pressEnter("shiftKey", heading)).toEqual({ blocks: 2, seenByTrailingPlugin: 0 });
	});
});
