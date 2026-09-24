import { Tag } from "@ext/markdown/core/render/logic/Markdoc";
import type { JSONContent } from "@tiptap/core";
import type { FragmentListItem } from "../types/constants";
import { filterFragments, getFragmentDescription } from "./fragmentsListUtils";

const fragments: FragmentListItem[] = [
	{ id: "first", title: "Getting Started", description: "Installation guide" },
	{ id: "second", title: "API Reference", description: "Available endpoints" },
	{ id: "empty", title: null, description: undefined },
];

describe("filterFragments", () => {
	it("matches fragment titles without regard to case", () => {
		expect(filterFragments(fragments, "getting")).toEqual([fragments[0]]);
	});

	it("matches fragment descriptions without regard to case", () => {
		expect(filterFragments(fragments, "ENDPOINTS")).toEqual([fragments[1]]);
	});

	it("handles missing titles and descriptions", () => {
		expect(() => filterFragments(fragments, "missing")).not.toThrow();
		expect(filterFragments(fragments, "missing")).toEqual([]);
	});

	it("returns every fragment for an empty query", () => {
		expect(filterFragments(fragments, "")).toEqual(fragments);
	});
});

describe("getFragmentDescription", () => {
	it("extracts text from nested fragment render nodes", () => {
		const content = [new Tag("p", {}, ["First", new Tag("strong", {}, ["second"])]), null, "third"];

		expect(getFragmentDescription(content)).toBe("First second third");
	});

	it("returns an empty string for render nodes without text", () => {
		expect(getFragmentDescription([null])).toBe("");
	});

	it("extracts text from JSONContent children produced by Renderer", () => {
		const content: JSONContent[] = [
			{
				type: "paragraph",
				content: [{ type: "text", text: "JSON content" }],
			},
		];

		expect(getFragmentDescription(content)).toBe("JSON content");
	});

	it("extracts text from arrays nested like Renderer content", () => {
		const content = [
			[
				{
					type: "paragraph",
					content: [{ type: "text", text: "Nested JSON content" }],
				},
			],
		] as unknown as JSONContent[];

		expect(getFragmentDescription(content)).toBe("Nested JSON content");
	});
});
