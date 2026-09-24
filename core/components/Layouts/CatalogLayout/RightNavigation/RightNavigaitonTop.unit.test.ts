import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";
import { RIGHT_NAVIGATION_WIDTH } from "./constants";
import { RightNavigationTopContent } from "./RightNavigaitonTop";

jest.mock("./SearchToolbar", () => ({
	SearchToolbar: () => jest.requireActual<typeof import("react")>("react").createElement("div", null, "search"),
}));
jest.mock("./ThemeButton", () => ({
	ThemeButton: () => jest.requireActual<typeof import("react")>("react").createElement("div", null, "theme"),
}));
jest.mock("./ContentLanguageToolbar", () => ({
	ContentLanguageToolbar: () =>
		jest.requireActual<typeof import("react")>("react").createElement("div", null, "mobile-actions"),
}));
jest.mock("@ext/settings/components/UserMenu", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => jest.requireActual<typeof import("react")>("react").createElement("div", null, "user"),
}));

describe("RightNavigationTopContent", () => {
	it("renders controls for both CSS-responsive presentations", () => {
		render(createElement(RightNavigationTopContent, { isEnterprise: false }));

		const controls = screen.getByTestId("right-navigation-top-controls");
		expect(controls.parentElement?.style.top).toBe(`${VIEWPORT_PADDING}px`);
		expect(controls.parentElement?.classList.contains("z-[var(--z-index-header-navigation)]")).toBe(true);
		expect(controls.parentElement?.style.right).toBe(`${VIEWPORT_PADDING}px`);
		expect(controls.parentElement?.classList.contains("inset-x-0")).toBe(false);
		expect(controls.style.width).toBe("");
		expect(controls.style.getPropertyValue("--right-navigation-width")).toBe(`${RIGHT_NAVIGATION_WIDTH}px`);
		expect(controls.classList).toContain("w-auto");
		expect(controls.classList).toContain(
			"[@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:w-[var(--right-navigation-width)]",
		);
		expect(screen.getByText("mobile-actions").parentElement?.classList).toContain("contents");
		expect(screen.getByText("mobile-actions").parentElement?.classList).toContain(
			"[@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:hidden",
		);
		expect(screen.getByText("search")).toBeTruthy();
		expect(screen.getByText("theme")).toBeTruthy();
		expect(screen.queryByText("user")).toBeNull();
		expect(screen.getByText("mobile-actions")).toBeTruthy();
	});

	it("replaces theme with the user menu for enterprise", () => {
		render(createElement(RightNavigationTopContent, { isEnterprise: true }));

		expect(screen.getByText("search")).toBeTruthy();
		expect(screen.getByText("user")).toBeTruthy();
		expect(screen.queryByText("theme")).toBeNull();
		expect(screen.getByText("mobile-actions")).toBeTruthy();
		expect(screen.getByTestId("right-navigation-top-controls").style.width).toBe("");
		expect(screen.getByTestId("right-navigation-top-controls").parentElement?.style.top).toBe(
			`${VIEWPORT_PADDING}px`,
		);
	});
});
