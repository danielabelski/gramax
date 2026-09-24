import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { createElement } from "react";
import { BranchButton } from "./BranchButton";
import { useCatalogViewportWidthStore } from "./catalogViewportWidthStore";
import { EXPANDED_RIGHT_NAVIGATION_CONTENT_CLASS_NAME, RIGHT_NAVIGATION_EXPAND_WIDTH_PINNED } from "./constants";

jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { value: {} },
}));
jest.mock("@core-ui/hooks/usePlatform", () => ({ usePlatform: () => ({ isNext: false }) }));
jest.mock("@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider", () => ({
	useCatalogPropsStore: (selector: (state: unknown) => unknown) =>
		selector({ data: { repositoryError: undefined, resolvedView: undefined } }),
}));
jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: (key: string) => key,
}));
jest.mock("@ext/storage/logic/utils/useStorage", () => ({ useIsStorageConnected: () => true }));
jest.mock("@ui-kit/FloatingPanel", () => ({ usePanelToggle: () => ({ isOpen: false, toggle: jest.fn() }) }));
jest.mock("@ui-kit/GlassToolbar", () => ({
	GlassToolbarIcon: ({ icon }: { icon: string }) => require("react").createElement("svg", { "data-icon": icon }),
	GlassToolbarSeparator: () => require("react").createElement("hr"),
	GlassToolbarText: ({ children, ...props }: React.ComponentProps<"span">) =>
		require("react").createElement("span", props, children),
	GlassToolbarToggleButton: ({
		active: _active,
		children,
		tooltipText,
		...props
	}: React.ComponentProps<"button"> & { active?: boolean; tooltipText?: string }) =>
		require("react").createElement("button", { ...props, "data-tooltip-text": tooltipText }, children),
}));
jest.mock("@ui-kit/Loader", () => ({ Loader: () => require("react").createElement("span", null, "loading") }));
jest.mock("@ui-kit/Tooltip", () => ({
	TextOverflowTooltip: ({ children }: { children: React.ReactNode }) =>
		require("react").createElement("span", null, children),
}));
jest.mock("./useCurrentBranch", () => ({
	useCurrentBranch: () => ({ branch: { name: "main" }, hasError: false }),
}));

describe("BranchButton", () => {
	afterEach(() => useCatalogViewportWidthStore.setState({ width: null }));

	it("renders only the branch icon in icon-only mode", () => {
		const IconOnlyBranchButton = BranchButton as ComponentType<{ iconOnly: boolean }>;
		const { getByTestId } = render(createElement(IconOnlyBranchButton, { iconOnly: true }));
		const button = getByTestId("branch-trigger");

		expect(button.textContent).toBe("");
		expect(button.querySelectorAll("[data-icon]")).toHaveLength(1);
	});

	it("collapses branch details at the same breakpoint as the right navigation", () => {
		useCatalogViewportWidthStore.setState({ width: RIGHT_NAVIGATION_EXPAND_WIDTH_PINNED - 1 });
		const ResponsiveBranchButton = BranchButton as ComponentType<{ collapseWithRightNavigation: boolean }>;
		const { getByTestId, getByText } = render(
			createElement(ResponsiveBranchButton, { collapseWithRightNavigation: true }),
		);

		expect(getByText("main").parentElement?.parentElement?.className).toBe(
			EXPANDED_RIGHT_NAVIGATION_CONTENT_CLASS_NAME,
		);
		expect(getByTestId("branch-trigger").getAttribute("data-tooltip-text")).toBe("git.branch.current: main");
	});

	it("drops the tooltip while the branch name is visible", () => {
		useCatalogViewportWidthStore.setState({ width: RIGHT_NAVIGATION_EXPAND_WIDTH_PINNED });
		const ResponsiveBranchButton = BranchButton as ComponentType<{ collapseWithRightNavigation: boolean }>;
		const { getByTestId } = render(createElement(ResponsiveBranchButton, { collapseWithRightNavigation: true }));

		expect(getByTestId("branch-trigger").getAttribute("data-tooltip-text")).toBeNull();
	});
});
