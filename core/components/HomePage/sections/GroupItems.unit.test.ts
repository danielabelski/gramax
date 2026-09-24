import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import GroupItems from "./GroupItems";

jest.mock("../HomeGroupContext", () => ({
	useHomeGroup: () => ({ setIsAnyCardLoading: () => {}, linkByName: {}, editMode: false }),
}));
jest.mock("./GroupStaticItems", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest's ESM interop flag has this fixed name.
	__esModule: true,
	default: ({ items }: { items: { id?: string }[] }) =>
		require("react").createElement("div", null, `static:${items.map((item) => item.id).join(",")}`),
}));

describe("GroupItems", () => {
	test("renders nested folders on a folder page without a drag container", () => {
		render(
			createElement(GroupItems, {
				catalogLinks: [],
				items: [{ type: "folder", id: "nested", title: "Nested", items: [] }],
			}),
		);

		expect(screen.getByText("static:nested")).toBeTruthy();
	});
});
