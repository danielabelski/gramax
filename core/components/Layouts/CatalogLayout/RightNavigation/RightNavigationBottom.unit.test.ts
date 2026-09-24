import { render } from "@testing-library/react";
import { createElement } from "react";
import { RightNavigationBottom } from "./RightNavigationBottom";

let mockIsMobile = false;

jest.mock("../useCanSeeNavigationBottom", () => ({
	useCanSeeNavigationBottom: () => true,
}));
jest.mock("@ui-kit/Sidebar", () => ({
	useSidebar: () => ({ isMobile: mockIsMobile }),
}));
jest.mock("@ext/errorHandlers/hooks/useIsOffline", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => false,
}));
jest.mock("@ext/storage/logic/utils/useStorage", () => ({
	useIsStorageConnected: () => true,
}));
jest.mock("./MergeRequestButton", () => ({ MergeRequestButton: () => "merge-request" }));
jest.mock("./BranchButton", () => ({
	BranchButton: ({ collapseWithRightNavigation }: { collapseWithRightNavigation?: boolean }) =>
		jest
			.requireActual<typeof import("react")>("react")
			.createElement(
				"span",
				{ "data-collapse-with-right-navigation": collapseWithRightNavigation, "data-testid": "branch" },
				"branch",
			),
}));
jest.mock("./HistoryButton", () => ({ HistoryButton: () => "history" }));
jest.mock("@ui-kit/GlassToolbar", () => ({
	GlassToolbar: ({ children }: { children: React.ReactNode }) =>
		jest.requireActual<typeof import("react")>("react").createElement("div", null, children),
}));

describe("RightNavigationBottom", () => {
	beforeEach(() => {
		mockIsMobile = false;
	});

	it("keeps the controls at their natural width", () => {
		const { container, getByTestId } = render(createElement(RightNavigationBottom));

		expect((container.firstElementChild as HTMLElement | null)?.style.width).toBe("");
		expect(getByTestId("branch").getAttribute("data-collapse-with-right-navigation")).toBe("true");
	});

	it("does not render article controls on mobile", () => {
		mockIsMobile = true;

		const { container } = render(createElement(RightNavigationBottom));

		expect(container.childElementCount).toBe(0);
	});
});
