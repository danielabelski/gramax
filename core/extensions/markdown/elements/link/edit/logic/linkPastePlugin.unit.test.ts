import { linkPastePlugin } from "@ext/markdown/elements/link/edit/logic/linkPastePlugin";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { schema as basicSchema } from "prosemirror-schema-basic";

const schema = new Schema({
	nodes: basicSchema.spec.nodes.addToEnd("video", {
		group: "block",
		atom: true,
		attrs: { path: { default: null } },
	}),
	marks: basicSchema.spec.marks,
});

const YOUTUBE_URL = "https://www.youtube.com/watch?v=F4ryW8YBZco";

const makeState = (text: string, from?: number, to?: number) => {
	const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text(text)])]);
	const selection =
		from === undefined ? TextSelection.create(doc, doc.content.size) : TextSelection.create(doc, from, to);

	return EditorState.create({ schema, doc, selection });
};

const pasteEvent = (text: string) => ({ clipboardData: { getData: () => text } }) as unknown as ClipboardEvent;

const setup = (state: EditorState) => {
	const view = {
		state,
		dispatch: jest.fn((tr) => {
			view.state = view.state.apply(tr);
		}),
	};

	const editor = {
		get state() {
			return view.state;
		},
		commands: {
			insertContentAt: jest.fn(() => true),
			toggleMark: jest.fn(() => true),
		},
	};

	const plugin = linkPastePlugin(editor);
	const handlePaste = (text: string) => plugin.props.handlePaste.call(plugin, view as never, pasteEvent(text), null);

	return { view, editor, handlePaste };
};

const linkHrefs = (state: EditorState) => {
	const hrefs: string[] = [];
	state.doc.descendants((node) => {
		node.marks.filter((mark) => mark.type.name === "link").forEach((mark) => hrefs.push(mark.attrs.href));
	});
	return hrefs;
};

describe("linkPastePlugin", () => {
	test("pasting a video url over selected text makes a link, not a video", () => {
		const { view, editor, handlePaste } = setup(makeState("смотри это", 1, 11));

		const handled = handlePaste(YOUTUBE_URL);

		expect(handled).toBe(true);
		expect(editor.commands.insertContentAt).not.toHaveBeenCalled();
		expect(linkHrefs(view.state)).toEqual([YOUTUBE_URL]);
		expect(view.state.doc.textContent).toBe("смотри это");
	});

	test("pasting a plain url over selected text keeps the text and marks it as a link", () => {
		const { view, handlePaste } = setup(makeState("смотри это", 1, 11));

		const handled = handlePaste("https://example.com/page");

		expect(handled).toBe(true);
		expect(linkHrefs(view.state)).toEqual(["https://example.com/page"]);
		expect(view.state.doc.textContent).toBe("смотри это");
	});

	test("pasting a video url without a selection still inserts a video", () => {
		const { view, editor, handlePaste } = setup(makeState("смотри это"));

		const handled = handlePaste(YOUTUBE_URL);

		expect(handled).toBe(true);
		expect(editor.commands.insertContentAt).toHaveBeenCalledWith(view.state.selection.from, {
			type: "video",
			attrs: { path: YOUTUBE_URL },
		});
	});

	test("pasting anything that is not a url is left to the editor", () => {
		const { view, editor, handlePaste } = setup(makeState("смотри это", 1, 11));

		expect(handlePaste("просто текст")).toBe(false);
		expect(editor.commands.insertContentAt).not.toHaveBeenCalled();
		expect(linkHrefs(view.state)).toEqual([]);
	});
});
