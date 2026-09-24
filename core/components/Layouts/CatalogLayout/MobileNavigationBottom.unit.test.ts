import { render } from "@testing-library/react";
import { createElement } from "react";
import MobileNavigationBottom from "./MobileNavigationBottom";

jest.mock("@ext/errorHandlers/hooks/useIsOffline", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => false,
}));
jest.mock("@ext/git/actions/Sync/components/Sync", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => require("react").createElement("span", { "data-testid": "sync-control" }, "sync-control"),
}));
jest.mock("./LeftNavigation/PublishButton", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: ({ iconOnly }: { iconOnly?: boolean }) =>
		require("react").createElement(
			"span",
			{ "data-icon-only": iconOnly, "data-testid": "publish-control" },
			"publish-control",
		),
}));
jest.mock("./RightNavigation/BranchButton", () => ({
	BranchButton: ({ iconOnly }: { iconOnly?: boolean }) =>
		require("react").createElement(
			"span",
			{ "data-icon-only": iconOnly, "data-testid": "branch-control" },
			"branch-control",
		),
}));
jest.mock("./RightNavigation/HistoryButton", () => ({
	HistoryButton: () =>
		require("react").createElement("span", { "data-testid": "history-control" }, "history-control"),
}));
jest.mock("@ui-kit/GlassToolbar", () => ({
	GlassToolbar: ({ children, className }: { children: React.ReactNode; className?: string }) =>
		require("react").createElement("div", { className, "data-testid": "glass-toolbar" }, children),
	GlassToolbarSeparator: () => require("react").createElement("hr"),
}));

describe("MobileNavigationBottom", () => {
	it("renders all navigation actions as icons in one toolbar", () => {
		const { container } = render(createElement(MobileNavigationBottom, { closeNavigation: jest.fn() }));

		expect(container.querySelectorAll('[data-testid="glass-toolbar"]')).toHaveLength(1);
		expect(container.textContent).toBe("sync-controlbranch-controlhistory-controlpublish-control");
		expect(container.querySelector('[data-testid="branch-control"]')?.getAttribute("data-icon-only")).toBe("true");
		expect(container.querySelector('[data-testid="publish-control"]')?.getAttribute("data-icon-only")).toBe("true");
	});

	it("sizes the toolbar to its content", () => {
		const { getByTestId } = render(createElement(MobileNavigationBottom, { closeNavigation: jest.fn() }));
		const toolbar = getByTestId("glass-toolbar");

		expect(toolbar.classList.contains("w-fit")).toBe(true);
		expect(toolbar.classList.contains("max-w-full")).toBe(true);
		expect(toolbar.classList.contains("w-full")).toBe(false);
	});
});
