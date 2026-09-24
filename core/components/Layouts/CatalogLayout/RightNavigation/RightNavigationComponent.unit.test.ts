import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import RightNavigationComponent from "./RightNavigationComponent";

jest.mock("@components/Layouts/CatalogLayout/RightNavigation/RightNavigaitonTop", () => ({
	RightNavigationTop: () => "responsive-navigation-toolbar",
}));

jest.mock("@components/Layouts/CatalogLayout/RightNavigation/RightNavigation", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => "right-navigation",
}));

jest.mock("@components/Layouts/CatalogLayout/RightNavigation/RightNavigationBottom", () => ({
	RightNavigationBottom: () =>
		jest
			.requireActual<typeof import("react")>("react")
			.createElement("div", { "data-testid": "right-navigation-bottom" }, "right-navigation-bottom"),
}));

jest.mock("@components/Layouts/CatalogLayout/RightNavigation/RightNavigationLayout", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: ({ children }: { children: ReactNode }) =>
		jest
			.requireActual<typeof import("react")>("react")
			.createElement("div", { "data-testid": "right-navigation-middle" }, children),
}));

describe("RightNavigationComponent", () => {
	it("renders one CSS-responsive tree before the viewport is measured", () => {
		render(createElement(RightNavigationComponent));

		expect(screen.getByText("right-navigation")).toBeTruthy();
		expect(screen.getByTestId("right-navigation-bottom")).toBeTruthy();
		expect(
			screen
				.getByTestId("right-navigation-middle")
				.firstElementChild?.classList.contains("pt-[calc(3.25rem+var(--catalog-titlebar-offset))]"),
		).toBe(false);
		expect(screen.getByText("responsive-navigation-toolbar")).toBeTruthy();
		expect(
			screen.getByTestId("right-navigation-middle").contains(screen.getByText("responsive-navigation-toolbar")),
		).toBe(false);
		const expandedNavigation = screen.getByTestId("right-navigation-middle").parentElement;
		expect(expandedNavigation?.contains(screen.getByTestId("right-navigation-bottom"))).toBe(false);
		expect(expandedNavigation?.classList).toContain("hidden");
		expect(expandedNavigation?.classList).toContain(
			"[@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:block",
		);
		expect(expandedNavigation?.classList).toContain(
			"[@container_catalog-viewport_(min-width:_1284px)]:[html[data-left-sidebar-pinned=false]_&]:block",
		);
	});
});
