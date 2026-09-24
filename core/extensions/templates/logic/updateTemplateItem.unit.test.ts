import type { TemplateItemProps } from "@ext/templates/components/TemplatesPanel/types/constants";
import type { JSONContent } from "@tiptap/core";
import { mergeTemplateItems, updateTemplateItem } from "./updateTemplateItem";

const body: JSONContent = {
	type: "doc",
	content: [
		{ type: "paragraph", content: [{ type: "text", text: "First paragraph" }] },
		{ type: "paragraph", content: [{ type: "text", text: "Second paragraph" }] },
	],
};

describe("updateTemplateItem", () => {
	it("updates title and preview without dropping the first body paragraph", () => {
		const item: TemplateItemProps = { id: "selected", title: "Old", description: "Old body", revision: 2 };

		expect(updateTemplateItem(item, body, " New title ")).toEqual({
			id: "selected",
			title: "New title",
			description: "First paragraph Second paragraph",
			revision: 3,
		});
	});

	it("does not mutate the source item or JSONContent", () => {
		const item: TemplateItemProps = { id: "selected", title: "Old", revision: 1 };
		const originalItem = structuredClone(item);
		const originalBody = structuredClone(body);

		const updated = updateTemplateItem(item, body, "Changed");

		expect(updated).not.toBe(item);
		expect(item).toEqual(originalItem);
		expect(body).toEqual(originalBody);
	});
});

describe("mergeTemplateItems", () => {
	it("keeps the current list when refresh fails", () => {
		const current = [{ id: "selected", title: "Local", description: "Local body", revision: 2 }];

		expect(mergeTemplateItems(current, null, "selected", new Map([["selected", 2]]))).toEqual(current);
	});

	it("preserves a selected local edit made during the request", () => {
		const local = { id: "selected", title: "Local", description: "Local body", revision: 2 };
		const server = { id: "selected", title: "Server", description: "Server body" };

		expect(mergeTemplateItems([local], [server], "selected", new Map([["selected", 1]]))).toEqual([local]);
	});

	it("updates other items from the server", () => {
		const selected = { id: "selected", title: "Local", revision: 2 };
		const otherServer = { id: "other", title: "Fresh", description: "Fresh body" };

		expect(
			mergeTemplateItems(
				[selected, { id: "other", title: "Old", revision: 4 }],
				[{ id: "selected", title: "Server" }, otherServer],
				"selected",
				new Map([
					["selected", 1],
					["other", 3],
				]),
			),
		).toEqual([selected, otherServer]);
	});

	it("updates an unchanged selected item from the server", () => {
		const server = { id: "selected", title: "Server", description: "Server body" };

		expect(
			mergeTemplateItems(
				[{ id: "selected", title: "Local", revision: 2 }],
				[server],
				"selected",
				new Map([["selected", 2]]),
			),
		).toEqual([server]);
	});

	it("accepts a server description when no local revision exists", () => {
		const server = { id: "selected", title: "Server", description: "Rendered body" };

		expect(mergeTemplateItems([{ id: "selected", title: "Old" }], [server], "selected", new Map())).toEqual([
			server,
		]);
	});
});
