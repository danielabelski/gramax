import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import HomeLayoutControls from "./HomeLayoutControls";
import { useHomepageLayoutStore } from "./store/homepageLayoutStore";

const mockUseCheckPermission = jest.fn();
const mockUseCheckAnyCatalogPermission = jest.fn();
// Jest hoists jest.mock factories above other statements, but it special-cases
// identifiers prefixed with "mock" so they may still be referenced here.
let mockIsEnterprise = true;
let mockPlatform = { isDocportal: false, isStatic: false };
let mockHasActiveWorkspace = true;
const mockFetch = jest.fn();

const mockPageDataContext = { conf: { enterpriseCloud: {} as { url?: string }, isReadOnly: false }, isLogged: true };

jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	get value() {
		return mockPageDataContext;
	},
}));
jest.mock("@core-ui/ContextServices/Workspace", () => ({
	current: () => ({ path: "workspace" }),
	hasActive: () => mockHasActiveWorkspace,
}));
jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	value: { saveWorkspaceSections: () => "workspace-save-sections" },
}));
jest.mock("@core-ui/ApiServices/FetchService", () => ({
	fetch: (...args: unknown[]) => mockFetch(...args),
}));
jest.mock("@core-ui/hooks/usePlatform", () => ({ usePlatform: () => mockPlatform }));
jest.mock("@ext/enterprise/utils/useIsEnterprise", () => ({ useIsEnterprise: () => mockIsEnterprise }));
jest.mock("@ext/enterprise-cloud/ui-logic/stores/GesCloudOrganizationStore/GesCloudOrganizationStore.provider", () => ({
	useGesCloudOrganizationStore: () => undefined,
}));
jest.mock("@ext/localization/locale/translate", () => (key: string) => key);
jest.mock("@ext/security/logic/Permission/components/PermissionService", () => ({
	useCheckPermission: (...args: unknown[]) => mockUseCheckPermission(...args),
	useCheckAnyCatalogPermission: (...args: unknown[]) => mockUseCheckAnyCatalogPermission(...args),
}));
jest.mock("@ui-kit/Dropdown", () => ({
	DropdownMenuGroup: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
	DropdownMenuLabel: ({ children }: { children: ReactNode }) =>
		require("react").createElement("span", null, children),
	DropdownMenuSeparator: () => null,
	DropdownMenuItem: ({
		children,
		disabled,
		onSelect,
	}: {
		children: ReactNode;
		disabled?: boolean;
		onSelect?: () => void;
	}) => require("react").createElement("button", { disabled, onClick: onSelect }, children),
}));
jest.mock("@ui-kit/Icon", () => ({ Icon: () => null }));
jest.mock("@ui-kit/Tabs", () => {
	const react = require("react");
	const TabsContext = react.createContext((_value: string) => {});

	return {
		Tabs: ({ children, onValueChange }: { children: ReactNode; onValueChange?: (value: string) => void }) =>
			react.createElement(TabsContext.Provider, { value: onValueChange ?? (() => {}) }, children),
		TabsList: ({ children }: { children: ReactNode }) => react.createElement("div", null, children),
		TabsTrigger: ({
			children,
			className,
			disabled,
			value,
		}: {
			children: ReactNode;
			className?: string;
			disabled?: boolean;
			value: string;
		}) => {
			const onValueChange = react.useContext(TabsContext);
			return react.createElement(
				"button",
				{ "data-view": value, className, disabled, onClick: () => onValueChange(value) },
				children,
			);
		},
	};
});
jest.mock("@ui-kit/Tooltip", () => ({
	Tooltip: ({ children }: { children: ReactNode }) => require("react").createElement("div", null, children),
	TooltipTrigger: ({ children }: { children: ReactNode }) => children,
	TooltipContent: ({ children }: { children: ReactNode }) => require("react").createElement("span", null, children),
}));

const renderControls = ({ admin, editor }: { admin: boolean; editor: boolean }) => {
	mockUseCheckPermission.mockReturnValue(admin);
	mockUseCheckAnyCatalogPermission.mockReturnValue(editor);
	mockFetch.mockResolvedValue(undefined);
	return render(createElement(HomeLayoutControls));
};

describe("HomeLayoutControls permissions", () => {
	beforeEach(() => {
		mockIsEnterprise = true;
		mockPlatform = { isDocportal: false, isStatic: false };
		mockHasActiveWorkspace = true;
		mockPageDataContext.conf.enterpriseCloud = {};
		mockPageDataContext.conf.isReadOnly = false;
		useHomepageLayoutStore.setState({
			activeView: "global",
			editScope: null,
			views: { global: { sections: [] }, personal: { sections: [] } },
			duplicateCatalogByScope: { global: false, personal: false },
			hasCatalogsByScope: { global: true, personal: true },
		});
	});

	test("workspace admin sees shared and personal views, editing the shared view", () => {
		const { container } = renderControls({ admin: true, editor: true });

		expect(container.querySelectorAll("[data-view]")).toHaveLength(2);
		expect(screen.getByText("configure-view-for-everyone")).toBeTruthy();
		expect(screen.getByText("shared-view").closest("button")?.className).toContain(
			"data-[state=active]:bg-primary-bg",
		);
	});

	test("keeps the selected view when the tabs emits the current value", () => {
		renderControls({ admin: true, editor: true });

		fireEvent.click(screen.getByText("shared-view"));

		expect(useHomepageLayoutStore.getState().activeView).toBe("global");
	});

	test("editor without admin rights can view shared layout but cannot edit it", () => {
		const { container } = renderControls({ admin: false, editor: true });

		expect(container.querySelectorAll("[data-view]")).toHaveLength(2);
		const editButton = screen.getByText("configure-view-for-everyone").closest("button") as HTMLButtonElement;
		expect(editButton.disabled).toBe(true);
		expect(screen.getByText("only-workspace-owner-can-edit-shared-view")).toBeTruthy();
	});

	test("editor without admin rights can switch back to and edit the personal layout", () => {
		renderControls({ admin: false, editor: true });

		fireEvent.click(screen.getByText("personal-view"));

		const editButton = screen.getByText("configure-personal-view").closest("button") as HTMLButtonElement;
		expect(editButton.disabled).toBe(false);
	});

	test("reviewer and reader see no homepage editing controls", () => {
		const { container } = renderControls({ admin: false, editor: false });

		expect(container.innerHTML).toBe("");
	});

	test("a catalog shared by two sections disables the edit button with an explanation", () => {
		useHomepageLayoutStore.setState({ duplicateCatalogByScope: { global: true, personal: false } });
		renderControls({ admin: true, editor: true });

		const editButton = screen.getByText("configure-view-for-everyone").closest("button") as HTMLButtonElement;
		expect(editButton.disabled).toBe(true);
		expect(screen.getByText("edit-homepage-view-disabled-duplicate-catalog")).toBeTruthy();
	});

	test("hides everything when the target view has no catalogs to organize", () => {
		useHomepageLayoutStore.setState({ hasCatalogsByScope: { global: false, personal: false } });
		const { container } = renderControls({ admin: true, editor: true });

		expect(container.innerHTML).toBe("");
	});

	test("uses catalogs from either view when deciding whether controls are available", () => {
		useHomepageLayoutStore.setState({
			activeView: "global",
			hasCatalogsByScope: { global: false, personal: true },
		});

		renderControls({ admin: true, editor: true });

		expect(screen.getByText("configure-view-for-everyone")).toBeTruthy();
	});

	test("hides everything outside the editor surfaces", () => {
		mockPlatform = { isDocportal: true, isStatic: false };
		const { container } = renderControls({ admin: true, editor: true });

		expect(container.innerHTML).toBe("");
	});

	test("hides everything on a static export", () => {
		mockPlatform = { isDocportal: false, isStatic: true };
		const { container } = renderControls({ admin: true, editor: true });

		expect(container.innerHTML).toBe("");
	});

	test("hides everything when there is no active workspace", () => {
		mockHasActiveWorkspace = false;
		const { container } = renderControls({ admin: true, editor: true });

		expect(container.innerHTML).toBe("");
	});

	test("a single-user (non-managed) workspace never offers the shared/personal switcher", () => {
		mockIsEnterprise = false;
		mockPageDataContext.conf.enterpriseCloud = {};
		const { container } = renderControls({ admin: true, editor: true });

		expect(container.querySelectorAll("[data-view]")).toHaveLength(0);
		expect(screen.getByText("configure-home-view")).toBeTruthy();
	});

	test("hides everything in read-only mode even with full permissions", () => {
		mockPageDataContext.conf.isReadOnly = true;
		const { container } = renderControls({ admin: true, editor: true });

		expect(container.innerHTML).toBe("");
	});

	test("does not offer a control to reset a personal override", () => {
		useHomepageLayoutStore.setState({
			activeView: "personal",
			hasPersonalOverride: true,
			views: {
				global: { sections: [{ id: "global", items: [] }] },
				personal: { sections: [{ id: "personal", items: [] }] },
			},
		});
		renderControls({ admin: false, editor: true });

		expect(screen.queryByText("reset-to-shared-view")).toBeNull();
	});
});
