import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import UserMenu from "./UserMenu";

jest.mock("@components/HomePage/HomeLayoutControls", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () =>
		jest
			.requireActual<typeof import("react")>("react")
			.createElement("div", { "data-testid": "home-layout-controls" }),
}));
jest.mock("@components/HomePage/leaveEditModeGuard", () => ({ leaveEditModeGuard: jest.fn().mockResolvedValue(true) }));
jest.mock("@core/Api/useRouter", () => ({ useRouter: () => ({}) }));
jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({ value: {} }));
jest.mock("@core-ui/ContextServices/ModalToOpenService/ModalToOpenService", () => ({
	addModal: jest.fn(),
	removeModal: jest.fn(),
	setValue: jest.fn(),
}));
jest.mock("@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: {},
}));
jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	value: {
		conf: {},
		isLogged: false,
		workspace: { current: "", workspaces: [] },
	},
}));
jest.mock("@core-ui/hooks/usePlatform", () => ({ usePlatform: () => ({ isTauri: false, isWeb: true }) }));
jest.mock("@ext/enterprise/components/SingInOut/hooks/useDesktopEnterpriseSession", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => ({ isCurrentEnterpriseSession: false, shouldOpenTauriGesModal: false }),
}));
jest.mock("@ext/enterprise/components/SingInOut/hooks/useSignOut", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => ({ canLogoutEnterprise: false, onLogoutClick: jest.fn() }),
}));
jest.mock("@ext/enterprise/components/SingInOut/SignInEnterprise", () => ({ useEnterpriseSignIn: () => jest.fn() }));
jest.mock("@ext/enterprise-cloud/GesCloudApi", () => ({ GesCloudApi: { getCloudInstanceUrl: jest.fn() } }));
jest.mock("@ext/localization/locale/translate", () => (key: string) => key);
jest.mock("@ext/settings/logic/settings", () => ({ Level: { app: "app" } }));
jest.mock("@ext/toggleFeatures/features", () => ({ feature: () => false }));
jest.mock("@ui-kit/Avatar", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Element = ({ children }: { children?: ReactNode }) => React.createElement("div", null, children);
	return {
		Avatar: Element,
		AvatarFallback: Element,
		AvatarLabel: Element,
		AvatarLabelAvatar: Element,
		AvatarLabelDescription: Element,
		AvatarLabelTitle: Element,
		getAvatarFallback: () => "",
	};
});
jest.mock("@ui-kit/Dropdown", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Element = ({ children }: { children?: ReactNode }) => React.createElement("div", null, children);
	return {
		DropdownMenu: Element,
		DropdownMenuContent: Element,
		DropdownMenuGroup: Element,
		DropdownMenuItem: Element,
		DropdownMenuLabel: Element,
		DropdownMenuSeparator: () => null,
		DropdownMenuTriggerButton: Element,
	};
});
jest.mock("@ui-kit/Icon", () => ({ Icon: () => null }));
jest.mock("@ui-kit/Tooltip", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Element = ({ children }: { children?: ReactNode }) => React.createElement("div", null, children);
	return { Tooltip: Element, TooltipContent: Element, TooltipTrigger: Element };
});
jest.mock("./AppSettingsTrigger", () => ({ openAppSettings: jest.fn() }));
jest.mock("./ThemeMenuItem", () => ({ ThemeMenuItem: () => null }));

describe("UserMenu", () => {
	it("does not mount homepage controls outside the homepage", () => {
		render(createElement(UserMenu));

		expect(screen.queryByTestId("home-layout-controls")).toBeNull();
	});

	it("mounts homepage controls when used on the homepage", () => {
		render(createElement(UserMenu, { showHomeLayoutControls: true }));

		expect(screen.getByTestId("home-layout-controls")).toBeTruthy();
	});
});
