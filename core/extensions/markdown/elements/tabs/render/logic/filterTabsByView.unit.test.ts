import type { CatalogView } from "@ext/catalog/views/models/CatalogViews";
import { Tag } from "@ext/markdown/core/render/logic/Markdoc";
import type { JSONContent } from "@tiptap/core";
import filterTabsByView from "./filterTabsByView";

test("filters a returned tabs tree without mutating cached content", () => {
	const cached = new Tag("tabs", {}, [
		new Tag("tab", { idx: 0, name: "Enterprise", property: [{ id: "distribution", value: ["enterprise"] }] }),
		new Tag("tab", { idx: 1, name: "Open source", property: [{ id: "distribution", value: ["open-source"] }] }),
	]);
	const view: CatalogView = {
		id: "open-source",
		name: "Open source",
		filters: [{ id: "distribution", value: ["enterprise"] }],
		properties: [],
	};

	const result = filterTabsByView(cached, view) as Tag[];

	expect(result).toHaveLength(1);
	expect(result[0].name).toBe("tab");
	expect(result[0].attributes).toMatchObject({ idx: 0, name: "Open source" });
	expect(cached.children).toHaveLength(2);
});

test("filters JSONContent returned in read mode", () => {
	const cached: JSONContent = {
		type: "tabs",
		content: [
			{ type: "tab", attrs: { idx: 0, property: [{ id: "distribution", value: ["enterprise"] }] } },
			{ type: "tab", attrs: { idx: 1, property: [{ id: "distribution", value: ["open-source"] }] } },
		],
	};
	const view: CatalogView = {
		id: "open-source",
		name: "Open source",
		filters: [{ id: "distribution", value: ["enterprise"] }],
		properties: [],
	};

	const result = filterTabsByView(cached, view) as JSONContent;

	expect(result.type).toBe("tab");
	expect(result.attrs).toMatchObject({ idx: 0, property: [{ value: ["open-source"] }] });
	expect(cached.content).toHaveLength(2);
});
