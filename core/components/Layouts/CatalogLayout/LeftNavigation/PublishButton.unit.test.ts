import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { createElement } from "react";
import PublishButton from "./PublishButton";

jest.mock("@core-ui/ContextServices/GitIndexService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { getOverview: () => ({ added: 1, deleted: 0, modified: 0 }) },
}));
jest.mock("@core-ui/ContextServices/Workspace", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { current: () => ({ path: "/workspace" }) },
}));
jest.mock("@core-ui/hooks/useWatch", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => undefined,
}));
jest.mock("@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider", () => ({
	useCatalogPropsStore: (selector: (state: unknown) => unknown) => selector({ data: { name: "catalog" } }),
}));
jest.mock("@ext/git/core/GitMergeRequest/logic/getMrStatus", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => undefined,
}));
jest.mock("@ext/git/core/GitMergeRequest/logic/store/MergeRequestStore", () => ({
	useMergeRequestStore: (selector: (state: unknown) => unknown) =>
		selector({ mergeRequest: undefined, isDraft: false }),
}));
jest.mock("@ext/git/core/GitPublish/PublishPanel/usePublishPanel", () => ({
	usePublishPanel: () => ({ isOpen: false, togglePublishPanel: jest.fn() }),
}));
jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: (key: string) => key,
}));
jest.mock("@ext/security/logic/Permission/components/PermissionService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { useCheckPermission: () => true },
}));
jest.mock("@ui-kit/Badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) =>
		require("react").createElement("span", { "data-testid": "badge" }, children),
}));
jest.mock("@ui-kit/FloatingPanel", () => ({ usePanelToggle: () => ({ isOpen: false }) }));
jest.mock("@ui-kit/GlassToolbar", () => ({
	GlassToolbarIcon: ({ icon }: { icon: string }) => require("react").createElement("svg", { "data-icon": icon }),
	GlassToolbarToggleButton: ({
		active: _active,
		children,
		...props
	}: React.ComponentProps<"button"> & { active?: boolean }) =>
		require("react").createElement("button", props, children),
}));

describe("PublishButton", () => {
	it("hides the label but keeps the changes badge in icon-only mode", () => {
		const IconOnlyPublishButton = PublishButton as ComponentType<{ iconOnly: boolean }>;
		const { getByTestId } = render(createElement(IconOnlyPublishButton, { iconOnly: true }));
		const button = getByTestId("publish-trigger");

		expect(button.textContent).toBe("1");
		expect(button.querySelectorAll("[data-icon]")).toHaveLength(1);
		expect(getByTestId("badge").textContent).toBe("1");
	});
});
