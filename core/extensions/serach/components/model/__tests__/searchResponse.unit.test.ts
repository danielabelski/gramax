import { Tag as MarkdocTag, type RenderableTreeNode } from "@ext/markdown/core/render/logic/Markdoc";
import { getSearchStatus, parseChatResponse } from "@ext/serach/components/model/searchResponse";
import { makeCitationPlaceholder } from "@ext/serach/types";
import { makeArticleResult, makeRows } from "./fixtures";

describe("getSearchStatus", () => {
	it("shows help while the input is empty and nothing loaded", () => {
		expect(getSearchStatus(true, null)).toBe("help");
	});

	it("shows loading once the input is not empty and nothing loaded yet", () => {
		expect(getSearchStatus(false, null)).toBe("loading");
	});

	it("shows empty for a search with no rows", () => {
		expect(getSearchStatus(false, { kind: "search", rows: [] })).toBe("empty");
	});

	it("shows results for a search with rows", () => {
		const rows = makeRows([makeArticleResult("docs/a.md")]);
		expect(getSearchStatus(false, { kind: "search", rows })).toBe("results");
	});

	it("shows results for chat even before any node arrives", () => {
		expect(getSearchStatus(false, { kind: "chat", nodes: undefined })).toBe("results");
	});
});

const paragraphChildren = async (markdown: string): Promise<RenderableTreeNode[]> => {
	const nodes = (await parseChatResponse(markdown)) as MarkdocTag;
	return (nodes.children[0] as MarkdocTag).children;
};

describe("parseChatResponse", () => {
	it("renders markdown into a node tree", async () => {
		expect(await paragraphChildren("hello **world**")).toEqual([
			"hello ",
			expect.objectContaining({ name: "strong", children: ["world"] }),
		]);
	});

	it("turns a citation placeholder into a ChatLink", async () => {
		const placeholder = makeCitationPlaceholder(1, "docs/intro", "./intro.md");
		const children = await paragraphChildren(`see ${placeholder}`);

		expect(children[1]).toBeInstanceOf(MarkdocTag);
		expect(children[1]).toEqual(
			expect.objectContaining({
				name: "ChatLink",
				attributes: expect.objectContaining({
					index: 1,
					href: "/docs/intro",
					resourcePath: "./intro.md",
				}),
				children: ["¹↗"],
			}),
		);
	});

	it("handles a partially streamed buffer", async () => {
		expect(await parseChatResponse("")).toBeDefined();
	});
});
