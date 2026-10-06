import type { ResourceServiceType } from "@core-ui/ContextServices/ResourceService/ResourceService";
import createImages from "@ext/markdown/elements/image/edit/logic/createImages";
import imageHandlePaste from "@ext/markdown/elements/image/edit/logic/imageHandlePaste";
import type { EditorView } from "prosemirror-view";

jest.mock("@ext/markdown/elements/image/edit/logic/createImages");

const mockCreateImages = createImages as jest.Mock;

type ClipboardShape = { files: File[]; plain?: string; html?: string };

const pasteEvent = ({ files, plain = "", html = "" }: ClipboardShape) =>
	({
		clipboardData: {
			files,
			items: files.map((file) => ({ type: file.type, getAsFile: () => file })),
			getData: (type: string) => (type === "text/plain" ? plain : type === "text/html" ? html : ""),
		},
	}) as unknown as ClipboardEvent;

describe("imageHandlePaste", () => {
	const view = {} as EditorView;
	const resourceService = {} as ResourceServiceType;
	const gif = () => new File([new Uint8Array([71, 73, 70])], "cat.gif", { type: "image/gif" });

	beforeEach(() => mockCreateImages.mockClear());

	test("inserts an image copied from a web page, where the clipboard also carries the img tag and its url", () => {
		const file = gif();
		const result = imageHandlePaste(
			view,
			pasteEvent({
				files: [file],
				plain: "https://example.com/cat.gif",
				html: '<img src="https://example.com/cat.gif" alt="cat">',
			}),
			"article",
			resourceService,
		);

		expect(mockCreateImages).toHaveBeenCalledWith([file], view, "article", resourceService);
		expect(result).toBe(true);
	});

	test("inserts an image copied from the system clipboard, where nothing else is on it", () => {
		const file = gif();
		const result = imageHandlePaste(view, pasteEvent({ files: [file] }), "article", resourceService);

		expect(mockCreateImages).toHaveBeenCalledWith([file], view, "article", resourceService);
		expect(result).toBe(true);
	});

	test("leaves a rich fragment to the html paste path, even though a picture rides along with it", () => {
		const result = imageHandlePaste(
			view,
			pasteEvent({
				files: [gif()],
				plain: "A paragraph about cats",
				html: '<p>A paragraph about cats <img src="https://example.com/cat.gif"></p>',
			}),
			"article",
			resourceService,
		);

		expect(mockCreateImages).not.toHaveBeenCalled();
		expect(result).toBe(false);
	});

	test("does nothing when the clipboard carries no files at all", () => {
		const result = imageHandlePaste(
			view,
			pasteEvent({ files: [], plain: "just text" }),
			"article",
			resourceService,
		);

		expect(mockCreateImages).not.toHaveBeenCalled();
		expect(result).toBe(false);
	});
});
