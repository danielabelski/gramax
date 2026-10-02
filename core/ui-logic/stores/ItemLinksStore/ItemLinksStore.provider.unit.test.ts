import { ItemType } from "@core/FileStructue/Item/ItemType";
import NavigationEvents from "@ext/navigation/NavigationEvents";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { ItemLinksStoreProvider, useItemLinks } from "./ItemLinksStore.provider";

const link = (path: string, title: string): ItemLink =>
	({
		type: ItemType.article,
		title,
		fileName: path.replace(/\.md$/, ""),
		icon: "",
		isCurrentLink: false,
		ref: { path, storageId: "s" },
		pathname: `/${path}`,
	}) as ItemLink;

let seen: ItemLink[] = [];
const Probe = () => {
	seen = useItemLinks();
	return null;
};

const tree = (itemLinks: ItemLink[]) =>
	// biome-ignore lint/correctness/noChildrenProp: createElement's rest-args overload rejects this component's required `children` prop
	createElement(ItemLinksStoreProvider, { itemLinks, children: createElement(Probe) });

describe("ItemLinksStoreProvider", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		seen = [];
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test("a live rename survives a stale itemLinks refresh that follows it", async () => {
		const { rerender } = render(tree([link("cat/a.md", "Old title")]));
		expect(seen[0].title).toBe("Old title");

		await act(async () => {
			await NavigationEvents.emit("item-rename", {
				from: { path: "cat/a.md", storageId: "s" },
				patch: {
					ref: { path: "cat/a.md", storageId: "s" },
					pathname: "/cat/a.md",
					fileName: "a",
					logicPath: "cat/a",
					title: "New title",
				},
				view: null,
				mutable: {},
			});
		});
		expect(seen[0].title).toBe("New title");

		// A page refetch racing the save it followed comes back with the pre-save title.
		act(() => {
			rerender(tree([link("cat/a.md", "Old title")]));
		});
		expect(seen[0].title).toBe("New title");

		// Once the grace window passes, a still-stale prop is trusted again (a later external
		// change must not be masked forever).
		jest.setSystemTime(Date.now() + 8001);
		act(() => {
			rerender(tree([link("cat/a.md", "Old title")]));
		});
		expect(seen[0].title).toBe("Old title");
	});
});
