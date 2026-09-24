import type { CatalogView } from "@ext/catalog/views/models/CatalogViews";
import getVisibleTabs from "./getVisibleTabs";

test("keeps tabs not excluded by the active catalog view and reindexes them", () => {
	const view: CatalogView = {
		id: "open-source",
		name: "Open source",
		filters: [{ id: "distribution", value: ["enterprise"] }],
		properties: [],
	};
	const result = getVisibleTabs(
		[
			{ idx: 0, name: "Enterprise", property: [{ id: "distribution", value: ["enterprise"] }] },
			{ idx: 1, name: "Open source", property: [{ id: "distribution", value: ["open-source"] }] },
		],
		view,
	);

	expect(result.indexes).toEqual([1]);
	expect(result.tabs).toEqual([
		{ idx: 0, name: "Open source", property: [{ id: "distribution", value: ["open-source"] }] },
	]);
});
