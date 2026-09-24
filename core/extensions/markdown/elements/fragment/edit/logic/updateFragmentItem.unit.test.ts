import type { JSONContent } from "@tiptap/core";
import { mergeFragmentItems, updateFragmentItem } from "./updateFragmentItem";

describe("updateFragmentItem", () => {
	it("updates title and description from editor content without mutating it", () => {
		const content: JSONContent = {
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "First paragraph" }] },
				{ type: "paragraph", content: [{ type: "text", text: "Second paragraph" }] },
			],
		};
		const originalContent = structuredClone(content);

		expect(updateFragmentItem({ id: "fragment", title: "Old title" }, content, " New title ")).toEqual({
			id: "fragment",
			title: "New title",
			description: "First paragraph Second paragraph",
			revision: 1,
		});
		expect(content).toEqual(originalContent);
	});

	it("uses an empty description when the fragment body has no text", () => {
		const content: JSONContent = {
			type: "doc",
			content: [{ type: "paragraph" }],
		};

		expect(updateFragmentItem({ id: "fragment", title: "Old title" }, content, "Title").description).toBe("");
	});
});

describe("mergeFragmentItems", () => {
	it("preserves the locally edited selected fragment and refreshes other fragments", () => {
		const current = [
			{ id: "selected", title: "Local title", description: "Local body", revision: 2 },
			{ id: "other", title: "Old other", description: "Old body" },
		];
		const incoming = [
			{ id: "selected", title: "Stale title", description: "Stale body" },
			{ id: "other", title: "Fresh other", description: "Fresh body" },
		];

		expect(mergeFragmentItems(current, incoming, "selected", new Map([["selected", 1]]))).toEqual([
			current[0],
			incoming[1],
		]);
	});

	it("uses refreshed data when the selected fragment has no live description", () => {
		const current = [{ id: "selected", title: "Title" }];
		const incoming = [{ id: "selected", title: "Title", description: "Loaded body" }];

		expect(mergeFragmentItems(current, incoming, "selected")).toEqual(incoming);
	});

	it("uses refreshed data when the selected fragment did not change during the request", () => {
		const current = [{ id: "selected", title: "Local title", description: "Local body", revision: 2 }];
		const incoming = [{ id: "selected", title: "Fresh title", description: "Fresh body" }];

		expect(mergeFragmentItems(current, incoming, "selected", new Map([["selected", 2]]))).toEqual(incoming);
	});
});
