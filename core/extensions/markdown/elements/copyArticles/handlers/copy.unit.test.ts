import type { CommentBlock } from "@core-ui/CommentBlock";
import { copy, createCodeBlockFragment } from "@ext/markdown/elements/copyArticles/handlers/copy";
import { Fragment, Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: { group: "block", content: "inline*" },
		code_block: { group: "block", content: "text*", code: true, marks: "", attrs: { language: { default: null } } },
		text: { group: "inline" },
	},
	marks: {},
});

test("copied code is wrapped in a single code block, preserving language and newlines", () => {
	const content = Fragment.from(schema.text("line1\nline2"));

	const fragment = createCodeBlockFragment(content, schema, { language: "ts" });

	expect(fragment.childCount).toBe(1);
	const codeBlock = fragment.firstChild;
	expect(codeBlock.type.name).toBe("code_block");
	expect(codeBlock.attrs.language).toBe("ts");
	expect(codeBlock.textContent).toBe("line1\nline2");
});

test("empty selection yields an empty code block rather than paragraphs", () => {
	const fragment = createCodeBlockFragment(Fragment.empty, schema, { language: null });

	expect(fragment.childCount).toBe(1);
	expect(fragment.firstChild.type.name).toBe("code_block");
	expect(fragment.firstChild.textContent).toBe("");
});

test("copies comment bodies from the editor that owns the clipboard event", () => {
	const commentBody: CommentBlock = {
		comment: {
			dateTime: "2026-01-01",
			content: [{ type: "text", text: "active editor comment" }],
			user: { mail: "author@example.com", name: "Author" },
		},
		answers: [],
	};
	const comments = new Map<string, CommentBlock>([["comment-1", commentBody]]);
	const clipboard = new Map<string, string>();
	const clipboardSchema = new Schema({
		nodes: {
			doc: { content: "block+" },
			heading: { group: "block", content: "inline*" },
			paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
			text: { group: "inline" },
		},
		marks: {
			comment: {
				attrs: { id: {} },
				toDOM: (mark) => ["span", { "data-comment-id": mark.attrs.id }, 0],
			},
		},
	});
	const commentMark = clipboardSchema.marks.comment.create({ id: "comment-1" });
	const doc = clipboardSchema.nodes.doc.create(null, [
		clipboardSchema.nodes.heading.create(null, clipboardSchema.text("Title")),
		clipboardSchema.nodes.paragraph.create(null, clipboardSchema.text("Commented", [commentMark])),
	]);
	const initialState = EditorState.create({ doc });
	const state = initialState.apply(
		initialState.tr.setSelection(TextSelection.create(initialState.doc, 8, initialState.doc.content.size)),
	);
	const range = document.createRange();
	range.selectNodeContents(document.body);
	jest.spyOn(window, "getSelection").mockReturnValue({ getRangeAt: () => range } as unknown as Selection);

	copy(
		{ state } as EditorView,
		{
			clipboardData: { setData: (type: string, value: string) => clipboard.set(type, value) },
		} as unknown as ClipboardEvent,
		{ logicPath: "comments/local" } as never,
		{ getBuffer: () => null } as never,
		{ comments },
	);

	expect(JSON.parse(clipboard.get("text/gramax")!).comments).toEqual({ "comment-1": commentBody });
});
