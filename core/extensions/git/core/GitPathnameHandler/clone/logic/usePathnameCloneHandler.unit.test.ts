import type PageDataContext from "@core/Context/PageDataContext";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { PageDataContextContext } from "@core-ui/ContextServices/PageDataContext";
import EnterpriseRouterPathEvents from "@ext/enterprise/pathname/EnterpriseRouterPathEvents";
import type WorkspaceManager from "@ext/workspace/WorkspaceManager";
import { renderHook } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import usePathnameCloneHandler from "./usePathnameCloneHandler";

const mockPushPath = jest.fn().mockResolvedValue(undefined);

jest.mock("@core/Api/useRouter", () => ({
	useRouter: () => ({ path: "/dr/repo/main/-/article", pushPath: mockPushPath }),
}));
jest.mock("@ext/git/actions/Clone/logic/useCloneRepo", () => ({
	useCloneRepo: () => ({ startClone: jest.fn() }),
}));
jest.mock("@core-ui/ContextServices/ModalToOpenService/ModalToOpenService", () => ({
	setValue: jest.fn(),
	resetValue: jest.fn(),
}));
jest.mock("@ext/localization/locale/translate", () => (key: string) => key);

describe("usePathnameCloneHandler", () => {
	const handler = new EnterpriseRouterPathEvents();

	afterEach(() => {
		handler.unmount();
		jest.clearAllMocks();
	});

	it("делегирует неразрешённую короткую ссылку enterprise event handler", () => {
		handler.mount();
		const context = {
			conf: { isReadOnly: false },
			shareData: {
				sourceType: null,
				filePath: ["article"],
				name: "repo",
				isPublic: false,
			},
		} as PageDataContext;
		const wrapper = ({ children }: PropsWithChildren) =>
			createElement(PageDataContextContext.Provider, { value: context }, children);

		renderHook(() => usePathnameCloneHandler(), { wrapper });

		expect(context.shareData).toBeNull();
		expect(mockPushPath).toHaveBeenCalledWith("/");
		expect(ModalToOpenService.setValue).toHaveBeenCalledWith(ModalToOpen.AlertConfirm, expect.any(Object));
	});

	it("продолжает clone-flow по короткой ссылке в managed workspace", () => {
		const wm = {
			maybeCurrent: () => ({
				yaml: () => ({ inner: () => ({ enterprise: { gesUrl: "https://ges.example" } }) }),
			}),
		} as unknown as WorkspaceManager;
		const managedHandler = new EnterpriseRouterPathEvents(wm);
		managedHandler.mount();
		const context = {
			conf: { isReadOnly: false },
			shareData: {
				sourceType: null,
				filePath: ["article"],
				name: "repo",
				isPublic: false,
			},
		} as PageDataContext;
		const wrapper = ({ children }: PropsWithChildren) =>
			createElement(PageDataContextContext.Provider, { value: context }, children);

		renderHook(() => usePathnameCloneHandler(), { wrapper });
		managedHandler.unmount();

		expect(context.shareData).toBeNull();
		expect(mockPushPath).not.toHaveBeenCalled();
		expect(ModalToOpenService.setValue).toHaveBeenCalledWith(ModalToOpen.CloneHandler, expect.any(Object));
	});
});
