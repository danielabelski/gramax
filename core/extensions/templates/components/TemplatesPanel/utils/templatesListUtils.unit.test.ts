import { Tag } from "@ext/markdown/core/render/logic/Markdoc";
import type { JSONContent } from "@tiptap/core";
import { filterTemplates, getTemplateDescription } from "./templatesListUtils";

const templates = [
	{ id: "first", title: "Getting Started", description: "Installation guide" },
	{ id: "second", title: "API Reference", description: "Available endpoints" },
	{ id: "empty", title: null, description: undefined },
];

describe("filterTemplates", () => {
	it("matches a title without regard to case", () => {
		expect(filterTemplates(templates, "GETTING")).toEqual([templates[0]]);
	});

	it("matches a description without regard to case", () => {
		expect(filterTemplates(templates, "endpoints")).toEqual([templates[1]]);
	});

	it("returns every template for an empty query", () => {
		expect(filterTemplates(templates, "")).toEqual(templates);
	});

	it("handles missing titles and descriptions", () => {
		expect(filterTemplates(templates, "missing")).toEqual([]);
	});
});

describe("getTemplateDescription", () => {
	it("extracts strings from nested Tag children in order", () => {
		const content = [new Tag("p", {}, ["First", new Tag("strong", {}, ["second"])]), "third"];

		expect(getTemplateDescription(content)).toBe("First second third");
	});

	it("extracts text from nested JSONContent", () => {
		const content: JSONContent = {
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "First JSON" }] },
				{ type: "paragraph", content: [{ type: "text", text: "second JSON" }] },
			],
		};

		expect(getTemplateDescription(content)).toBe("First JSON second JSON");
	});

	it("supports mixed arrays of Tag, JSONContent, strings and null", () => {
		const content = [
			new Tag("p", {}, ["Tag text"]),
			{ type: "paragraph", content: [{ type: "text", text: "JSON text" }] },
			null,
			"string text",
		];

		expect(getTemplateDescription(content)).toBe("Tag text JSON text string text");
	});

	it("returns an empty string for null and empty content", () => {
		expect(getTemplateDescription(null)).toBe("");
		expect(getTemplateDescription([])).toBe("");
	});

	it("normalizes repeated whitespace and trims the preview", () => {
		expect(getTemplateDescription(["  First\n\t", new Tag("span", {}, [" second   text "])])).toBe(
			"First second text",
		);
	});
});
