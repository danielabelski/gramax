import { renderHook } from "@testing-library/react";
import { useHomepageLayoutStore } from "../store/homepageLayoutStore";
import { useHomeLayoutControls } from "./useHomeLayoutControls";

const mockUseCheckPermission = jest.fn();
const mockUseCheckAnyCatalogPermission = jest.fn();
let mockIsEnterprise = true;
let mockPlatform = { isDocportal: false, isStatic: false };
let mockHasActiveWorkspace = true;
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
jest.mock("@core-ui/hooks/usePlatform", () => ({ usePlatform: () => mockPlatform }));
jest.mock("@ext/enterprise/utils/useIsEnterprise", () => ({ useIsEnterprise: () => mockIsEnterprise }));
jest.mock("@ext/enterprise-cloud/ui-logic/stores/GesCloudOrganizationStore/GesCloudOrganizationStore.provider", () => ({
	useGesCloudOrganizationStore: () => undefined,
}));
jest.mock("@ext/security/logic/Permission/components/PermissionService", () => ({
	useCheckPermission: (...args: unknown[]) => mockUseCheckPermission(...args),
	useCheckAnyCatalogPermission: (...args: unknown[]) => mockUseCheckAnyCatalogPermission(...args),
}));

describe("useHomeLayoutControls", () => {
	beforeEach(() => {
		mockIsEnterprise = true;
		mockPlatform = { isDocportal: false, isStatic: false };
		mockHasActiveWorkspace = true;
		mockPageDataContext.conf.enterpriseCloud = {};
		mockPageDataContext.conf.isReadOnly = false;
		mockUseCheckPermission.mockReturnValue(false);
		mockUseCheckAnyCatalogPermission.mockReturnValue(false);
		useHomepageLayoutStore.setState({
			activeView: "global",
			editScope: null,
			duplicateCatalogByScope: { global: false, personal: false },
			hasCatalogsByScope: { global: true, personal: true },
		});
	});

	it("allows an editor to view the shared layout but not edit it", () => {
		mockUseCheckAnyCatalogPermission.mockReturnValue(true);

		const { result } = renderHook(() => useHomeLayoutControls());

		expect(result.current.isVisible).toBe(true);
		expect(result.current.canShowSharedView).toBe(true);
		expect(result.current.editScopeTarget).toBe("global");
		expect(result.current.editDisabledByPermission).toBe(true);
	});

	it("hides controls for users without homepage-edit permissions", () => {
		const { result } = renderHook(() => useHomeLayoutControls());

		expect(result.current.isVisible).toBe(false);
	});

	it("uses the personal view as the edit target in a local workspace", () => {
		mockIsEnterprise = false;
		mockUseCheckAnyCatalogPermission.mockReturnValue(true);

		const { result } = renderHook(() => useHomeLayoutControls());

		expect(result.current.canShowSharedView).toBe(false);
		expect(result.current.editScopeTarget).toBe("personal");
	});

	it("does not offer the edit entry point from a nested folder page", () => {
		mockUseCheckAnyCatalogPermission.mockReturnValue(true);
		useHomepageLayoutStore.setState({ isMainPage: false });

		const { result } = renderHook(() => useHomeLayoutControls());

		expect(result.current.isVisible).toBe(false);
	});
});
