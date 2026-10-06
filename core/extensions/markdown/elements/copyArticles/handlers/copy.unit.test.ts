import type { CommentBlock } from "@core-ui/CommentBlock";
import type { ClipboardSource } from "@ext/markdown/elements/copyArticles/handlers/copy";
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

const imageSchema = new Schema({
	nodes: {
		doc: { content: "block+" },
		heading: { group: "block", content: "inline*", toDOM: () => ["h1", 0] },
		image: {
			group: "block",
			atom: true,
			draggable: true,
			attrs: { src: {} },
			toDOM: (node) => ["img", { src: node.attrs.src }],
		},
		text: { group: "inline" },
	},
	marks: {},
});

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const runImageCopy = (srcs: string[], source?: ClipboardSource) => {
	// The single-image short-circuit writes a real image to the OS clipboard; jsdom ships neither API.
	(globalThis as { ClipboardItem?: unknown }).ClipboardItem ??= class {
		constructor(readonly items: unknown) {}
	};
	Object.defineProperty(globalThis.navigator, "clipboard", {
		value: { write: () => Promise.resolve() },
		configurable: true,
	});

	const clipboard = new Map<string, string>();
	const doc = imageSchema.nodes.doc.create(null, [
		imageSchema.nodes.heading.create(null, imageSchema.text("Title")),
		...srcs.map((src) => imageSchema.nodes.image.create({ src })),
	]);
	const initialState = EditorState.create({ doc });
	// Select everything after the title heading — the whole run of images.
	const from = doc.firstChild.nodeSize;
	const state = initialState.apply(
		initialState.tr.setSelection(TextSelection.create(initialState.doc, from, initialState.doc.content.size)),
	);

	const range = document.createRange();
	range.selectNodeContents(document.body);
	jest.spyOn(window, "getSelection").mockReturnValue({ getRangeAt: () => range } as unknown as Selection);

	copy(
		{ state } as EditorView,
		{
			clipboardData: { setData: (type: string, value: string) => clipboard.set(type, value) },
		} as unknown as ClipboardEvent,
		{ logicPath: "images/local" } as never,
		{ getBuffer: () => Buffer.from(PNG_SIGNATURE) } as never,
		{ source },
	);

	return clipboard;
};

test("copying several images keeps every image in the internal clipboard payload", () => {
	const clipboard = runImageCopy(["a.png", "b.png", "c.png"]);

	const payload = clipboard.get("text/gramax");
	expect(payload).toBeDefined();
	expect(JSON.parse(payload!).data).toHaveLength(3);
});

test("copying a single image still defers to the OS clipboard, not the internal payload", () => {
	const clipboard = runImageCopy(["only.png"]);

	// A lone image is handed to the OS clipboard as a real image; no internal payload is produced.
	expect(clipboard.get("text/gramax")).toBeUndefined();
});

test("the payload names the article it was copied from, so paste can re-read resources it lacks", () => {
	const source: ClipboardSource = { catalogName: "docs", articlePath: "guides/source.md" };

	const clipboard = runImageCopy(["a.png", "b.png"], source);

	expect(JSON.parse(clipboard.get("text/gramax")!).source).toEqual(source);
});

describe("copying a lone image", () => {
	const imageSchema = new Schema({
		nodes: {
			doc: { content: "block+" },
			heading: { group: "block", content: "inline*" },
			paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
			image: { group: "block", attrs: { src: {} }, toDOM: (node) => ["img", { src: node.attrs.src }] },
			text: { group: "inline" },
		},
	});

	const copyImage = (bytes: number[]) => {
		const doc = imageSchema.nodes.doc.create(null, [
			imageSchema.nodes.heading.create(null, imageSchema.text("Title")),
			imageSchema.nodes.image.create({ src: "./cat" }),
		]);
		const initialState = EditorState.create({ doc });
		const state = initialState.apply(
			initialState.tr.setSelection(TextSelection.create(initialState.doc, 7, initialState.doc.content.size)),
		);
		const range = document.createRange();
		range.selectNodeContents(document.body);
		jest.spyOn(window, "getSelection").mockReturnValue({ getRangeAt: () => range } as unknown as Selection);

		const clipboard = new Map<string, string>();
		copy(
			{ state } as EditorView,
			{
				clipboardData: { setData: (type: string, value: string) => clipboard.set(type, value) },
			} as unknown as ClipboardEvent,
			{ logicPath: "images/local" } as never,
			{ getBuffer: () => Buffer.from(bytes) } as never,
		);
		return clipboard;
	};

	let write: jest.Mock;

	beforeEach(() => {
		write = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { value: { write }, configurable: true });
		(global as unknown as { ClipboardItem: unknown }).ClipboardItem = class {
			constructor(readonly items: Record<string, Blob>) {}
		};
	});

	test("a png goes to the clipboard as the image itself", () => {
		const clipboard = copyImage([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

		expect(write).toHaveBeenCalledTimes(1);
		expect(Object.keys(write.mock.calls[0][0][0].items)).toEqual(["image/png"]);
		expect(clipboard.size).toBe(0);
	});

	test("a gif, which the async clipboard cannot write, goes the regular way and keeps its file", () => {
		const clipboard = copyImage([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

		expect(write).not.toHaveBeenCalled();
		expect(clipboard.get("text/gramax")).toContain("./cat");
	});
});
