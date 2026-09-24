import { videoWordLayout } from "./video";

// docx keeps a component's children in `root`, mixed with its properties object;
// the class name is the only thing that distinguishes a hyperlink from a plain run.
type DocxComponent = { root: unknown[] };

const childNames = (paragraph: unknown) =>
	(paragraph as DocxComponent).root
		.map((child) => (child as object)?.constructor?.name)
		.filter((name) => name !== "ParagraphProperties");

const layout = async (attributes: Record<string, unknown>) =>
	videoWordLayout({ tag: { attributes } } as unknown as Parameters<typeof videoWordLayout>[0]);

describe("videoWordLayout", () => {
	it("does not emit a hyperlink when a video block has no url", async () => {
		const [paragraph] = await layout({ path: null, title: "clip" });

		expect(childNames(paragraph)).toEqual(["TextRun", "TextRun"]);
	});

	it("wraps the runs in a hyperlink when the video has a url", async () => {
		const [paragraph] = await layout({ path: "https://example.com/clip.mp4", title: "clip" });

		expect(childNames(paragraph)).toEqual(["ExternalHyperlink"]);
	});
});
