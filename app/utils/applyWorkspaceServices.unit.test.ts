import type SettingsResolver from "@ext/settings/logic/SettingsResolver";
import type { Workspace } from "@ext/workspace/Workspace";
import type { WorkspaceConfig } from "@ext/workspace/WorkspaceConfig";
import setWorkerProxy from "../../apps/web/src/logic/setWorkerProxy";
import applyWorkspaceServices from "./applyWorkspaceServices";

jest.mock("@app/resolveModule/env", () => ({ getExecutingEnvironment: () => "web" }));
// biome-ignore lint/style/useNamingConvention: the marker jest needs to hand back an ES-module mock
jest.mock("../../apps/web/src/logic/setWorkerProxy", () => ({ __esModule: true, default: jest.fn() }));

const APP_LEVEL_PROXY = "https://app/git-proxy";

const workspaceStating = (services?: WorkspaceConfig["services"]) =>
	({ yaml: () => ({ get: (key: string) => (key === "services" ? services : undefined) }) }) as unknown as Workspace;

const settingsResolving = (endpoint?: string) =>
	({ resolveServices: () => (endpoint ? { "git-proxy": { endpoint } } : {}) }) as unknown as SettingsResolver;

describe("applyWorkspaceServices", () => {
	beforeEach(() => jest.clearAllMocks());

	it("sends the app-level proxy when the workspace states no gitProxy", () => {
		applyWorkspaceServices(settingsResolving(APP_LEVEL_PROXY), workspaceStating(undefined));

		expect(setWorkerProxy).toHaveBeenCalledWith(APP_LEVEL_PROXY);
	});

	it("empties the proxy when the workspace states gitProxy explicitly empty", () => {
		const workspace = workspaceStating({ gitProxy: { url: null } } as WorkspaceConfig["services"]);

		applyWorkspaceServices(settingsResolving(APP_LEVEL_PROXY), workspace);

		expect(setWorkerProxy).toHaveBeenCalledWith(null);
	});

	it("sends the workspace's own proxy when it states one", () => {
		const workspace = workspaceStating({
			gitProxy: { url: "https://ges/git-proxy" },
		} as WorkspaceConfig["services"]);

		applyWorkspaceServices(settingsResolving("https://ges/git-proxy"), workspace);

		expect(setWorkerProxy).toHaveBeenCalledWith("https://ges/git-proxy");
	});

	it("never sends undefined, which the worker would store as a literal proxy address", () => {
		applyWorkspaceServices(settingsResolving(undefined), workspaceStating(undefined));

		expect(setWorkerProxy).toHaveBeenCalledWith(null);
	});
});
