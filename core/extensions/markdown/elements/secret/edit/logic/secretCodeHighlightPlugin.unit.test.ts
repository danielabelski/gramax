import { secretCodeHighlightPluginKey } from "@ext/markdown/elements/secret/edit/logic/secretCodeHighlightPlugin";
import SecretNode from "@ext/markdown/elements/secret/edit/model/secretNode";
import { Editor } from "@tiptap/core";
import CodeBlock from "@tiptap/extension-code-block";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import assert from "assert";
import { Slice } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";

// "prefix ${MYAPI.token} suffix" — the codeBlock's only text node, starting at doc pos 1.
// biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${} secret placeholders
const CODE_TEXT = "prefix ${MYAPI.token} suffix";
const VAR_FROM = 8; // pos of "$"
const VAR_TO = 22; // pos right after "}"

const createEditor = () =>
	new Editor({
		extensions: [
			Document,
			Text,
			CodeBlock.extend({ name: "code_block" }),
			SecretNode.configure({ knownNames: ["MYAPI"] }),
		],
		content: {
			type: "doc",
			content: [{ type: "code_block", content: [{ type: "text", text: CODE_TEXT }] }],
		},
	});

/** Retrieves our plugin's own props directly, bypassing `someProp`'s cross-plugin fallthrough — other
 *  extensions (e.g. the core Keymap) also implement handleKeyDown, and would otherwise intercept the event first. */
const getOwnPlugin = (editor: Editor): Plugin => {
	const plugin = secretCodeHighlightPluginKey.get(editor.state);
	assert(plugin);
	return plugin;
};

describe("secretCodeHighlightPlugin", () => {
	let editor: Editor;

	beforeEach(() => {
		editor = createEditor();
	});

	it("blocks a point insertion strictly inside the variable", () => {
		const { view } = editor;
		const plugin = getOwnPlugin(editor);
		const insideVarPos = VAR_FROM + 4; // inside "MYAPI"

		expect(
			plugin.props.handleTextInput!.call(plugin, view, insideVarPos, insideVarPos, "z", () => view.state.tr),
		).toBeFalsy();

		view.dispatch(view.state.tr.insertText("z", insideVarPos, insideVarPos));
		expect(view.state.doc.textContent).toBe(CODE_TEXT);
	});

	it("expands a partial selection to the whole variable when typing over it", () => {
		const { view } = editor;
		const plugin = getOwnPlugin(editor);
		// selects "PI.token}" — starts inside the name, ends exactly at the closing brace
		const selFrom = VAR_FROM + 5;
		const selTo = VAR_TO;

		expect(plugin.props.handleTextInput!.call(plugin, view, selFrom, selTo, "X", () => view.state.tr)).toBe(true);
		expect(view.state.doc.textContent).toBe("prefix X suffix");
	});

	it("expands the selection before a paste that partially overlaps the variable", () => {
		const { view } = editor;
		const plugin = getOwnPlugin(editor);
		const selFrom = VAR_FROM + 5;
		const selTo = VAR_TO;
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selFrom, selTo)));

		const handled = plugin.props.handlePaste!.call(plugin, view, {} as ClipboardEvent, Slice.empty);
		expect(handled).toBeFalsy();
		expect(view.state.selection.from).toBe(VAR_FROM);
		expect(view.state.selection.to).toBe(VAR_TO);
	});

	it("deletes the whole variable on Backspace over a partial selection", () => {
		const { view } = editor;
		const plugin = getOwnPlugin(editor);
		const selFrom = VAR_FROM + 5;
		const selTo = VAR_TO;
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selFrom, selTo)));

		const handled = plugin.props.handleKeyDown!.call(
			plugin,
			view,
			new KeyboardEvent("keydown", { key: "Backspace" }),
		);
		expect(handled).toBe(true);
		expect(view.state.doc.textContent).toBe("prefix  suffix");
	});

	it("rejects a raw partial-range change that bypasses all input hooks (e.g. drag-drop)", () => {
		const { view } = editor;
		const partialFrom = VAR_FROM + 5;
		const partialTo = VAR_FROM + 10;

		view.dispatch(view.state.tr.delete(partialFrom, partialTo));
		expect(view.state.doc.textContent).toBe(CODE_TEXT);
	});

	it("still allows deleting the whole variable directly", () => {
		const { view } = editor;
		view.dispatch(view.state.tr.delete(VAR_FROM, VAR_TO));
		expect(view.state.doc.textContent).toBe("prefix  suffix");
	});

	it("keeps an untouched variable's decorations when another one in the same block is deleted", () => {
		// Two variables far apart in one code block — editing the second must not disturb the first.
		// biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${} secret placeholders
		const FIRST_VAR = "${MYAPI.token}";
		// biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${} secret placeholders
		const SECOND_VAR = "${MYAPI.login}";
		const text = `prefix ${FIRST_VAR} middle ${SECOND_VAR} suffix`;
		const twoVarEditor = new Editor({
			extensions: [
				Document,
				Text,
				CodeBlock.extend({ name: "code_block" }),
				SecretNode.configure({ knownNames: ["MYAPI"] }),
			],
			content: { type: "doc", content: [{ type: "code_block", content: [{ type: "text", text }] }] },
		});
		const { view } = twoVarEditor;

		const firstFrom = 1 + text.indexOf(FIRST_VAR);
		const firstTo = firstFrom + FIRST_VAR.length;
		const secondFrom = 1 + text.indexOf(SECOND_VAR);
		const secondTo = secondFrom + SECOND_VAR.length;

		const decorationsBefore = secretCodeHighlightPluginKey.getState(view.state)?.decorations;
		expect(decorationsBefore?.find(firstFrom, firstTo).length).toBeGreaterThan(0);
		expect(decorationsBefore?.find(secondFrom, secondTo).length).toBeGreaterThan(0);

		view.dispatch(view.state.tr.delete(secondFrom, secondTo));

		const decorationsAfter = secretCodeHighlightPluginKey.getState(view.state)?.decorations;
		// The first variable sits entirely before the deleted range, so it isn't touched by this
		// transaction at all — it must still be decorated. A naive rebuild that only considered the
		// touched span in isolation (instead of mapping the rest of the set forward) would drop this.
		expect(decorationsAfter?.find(firstFrom, firstTo).length).toBeGreaterThan(0);
		// The deleted variable's decorations are gone, with nothing stale left at the collapsed spot.
		expect(decorationsAfter?.find(secondFrom, secondFrom).length).toBe(0);
	});

	it("doesn't accumulate decorations when typing elsewhere in a block that holds several variables", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: testing ${} secret placeholders
		const text = "${MYAPI.token} and ${MYAPI.login}";
		const twoVarEditor = new Editor({
			extensions: [
				Document,
				Text,
				CodeBlock.extend({ name: "code_block" }),
				SecretNode.configure({ knownNames: ["MYAPI"] }),
			],
			content: { type: "doc", content: [{ type: "code_block", content: [{ type: "text", text }] }] },
		});
		const { view } = twoVarEditor;
		const countDecorations = () => secretCodeHighlightPluginKey.getState(view.state)!.decorations.find().length;

		const initialCount = countDecorations();
		expect(initialCount).toBeGreaterThan(0);

		// A rescan of the touched range returns every match of the whole textblock, not just the ones
		// inside that range. Removing by the narrow touched span while adding back the block's full
		// result re-added the variables that were never removed, so each keystroke duplicated their
		// decorations — two extra label widgets per press, growing for as long as the user kept typing.
		for (let i = 0; i < 5; i++) {
			const endPos = view.state.doc.content.size - 1;
			view.dispatch(view.state.tr.insertText("x", endPos, endPos));
			expect(countDecorations()).toBe(initialCount);
		}
	});
});
