import RouterPathProvider from "@core/RouterPath/RouterPathProvider";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import type WorkspaceManager from "@ext/workspace/WorkspaceManager";
import EnterpriseRouterPathEvents from "./EnterpriseRouterPathEvents";

jest.mock("@core-ui/ContextServices/ModalToOpenService/ModalToOpenService", () => ({
	setValue: jest.fn(),
	resetValue: jest.fn(),
}));
jest.mock("@ext/localization/locale/translate", () => (key: string) => key);

describe("EnterpriseRouterPathEvents", () => {
	const handler = new EnterpriseRouterPathEvents();
	afterEach(() => {
		handler.unmount();
		jest.clearAllMocks();
	});

	it("перехватывает неразрешённую короткую ссылку и показывает GES-модалку", () => {
		handler.mount();
		const mutable: { handled?: boolean } = {};

		RouterPathProvider.events.emitSync("unresolved-path", { path: "/dr/repo/main/-/article", mutable });

		expect(mutable.handled).toBe(true);
		expect(ModalToOpenService.setValue).toHaveBeenCalledWith(ModalToOpen.AlertConfirm, expect.any(Object));
	});

	it("не перехватывает полную ссылку внешнего хранилища", () => {
		handler.mount();
		const mutable: { handled?: boolean } = {};

		RouterPathProvider.events.emitSync("unresolved-path", {
			path: "/gitlab.example/dr/repo/main/-/article",
			mutable,
		});

		expect(mutable.handled).toBeUndefined();
		expect(ModalToOpenService.setValue).not.toHaveBeenCalled();
	});

	it("не перехватывает короткую ссылку в managed workspace", () => {
		const wm = {
			maybeCurrent: () => ({
				yaml: () => ({ inner: () => ({ enterprise: { gesUrl: "https://ges.example" } }) }),
			}),
		} as unknown as WorkspaceManager;
		const managedHandler = new EnterpriseRouterPathEvents(wm);
		managedHandler.mount();
		const mutable: { handled?: boolean } = {};

		RouterPathProvider.events.emitSync("unresolved-path", { path: "/dr/repo/main/-/article", mutable });
		managedHandler.unmount();

		expect(mutable.handled).toBeUndefined();
		expect(ModalToOpenService.setValue).not.toHaveBeenCalled();
	});

	it.each(["dr", "team.docs"])("parses short URL for the %s group through events", (group) => {
		handler.mount();
		const path = `${group}/repo/main/-/article`;
		expect(RouterPathProvider.isEditorPathname(path)).toBe(true);
		expect(RouterPathProvider.parsePath(path)).toMatchObject({
			sourceName: null,
			group,
			repo: "repo",
			refname: "main",
			filePath: ["article"],
		});
		expect(RouterPathProvider.getLogicPath(path)).toBe("repo/article");
	});

	it("сохраняет короткий формат при смене ветки и снимает подписки", () => {
		handler.mount();
		handler.mount();
		expect(RouterPathProvider.updatePathnameData("dr/repo/main/-/article", { refname: "develop" }).value).toBe(
			"dr/repo/develop/-/article",
		);
		handler.unmount();
		expect(RouterPathProvider.isEditorPathname("dr/repo/main/-/article")).toBe(true);
		expect(RouterPathProvider.parsePath("dr/repo/main/-/article").sourceName).toBe("dr");
	});

	it("разбирает полный URL с bare hostname", () => {
		handler.mount();
		expect(RouterPathProvider.parsePath("ges/dr/repo/main/-/article")).toMatchObject({
			sourceName: "ges",
			group: "dr",
			repo: "repo",
			refname: "main",
		});
	});
});
