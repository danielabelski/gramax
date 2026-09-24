import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { TopBarContentMobile } from "./TopBarContentMobile";

jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: (key: string) => key,
}));

describe("TopBarContentMobile", () => {
	it("renders the sidebar toggle without the catalog title", () => {
		const toggleSidebar = jest.fn();
		render(createElement(TopBarContentMobile, { toggleSidebar }));

		fireEvent.click(screen.getByRole("button", { name: "left-navigation.expand" }));

		expect(toggleSidebar).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("catalog-title")).toBeNull();
	});
});
