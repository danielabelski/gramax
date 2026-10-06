import logout from "@app/commands/enterprise/logout";
import type Context from "@core/Context/Context";

const mockEnterpriseLogout = jest.fn();

jest.mock("@app/resolveModule/env", () => ({
	...jest.requireActual("@app/resolveModule/env"),
	getExecutingEnvironment: () => "browser",
}));
jest.mock("@ext/enterprise/EnterpriseApi", () =>
	jest.fn().mockImplementation(() => ({ logout: mockEnterpriseLogout })),
);

const gesUrl = "https://enterprise.example.com";

const setup = (sourceDatas: unknown[]) => {
	const removeSourceData = jest.fn();
	const removeAiData = jest.fn();
	const ampLogout = jest.fn();
	// biome-ignore lint/style/useNamingConvention: Command keeps its app and commands in private _app/_commands fields
	const command = logout as unknown as { _app: unknown; _commands: unknown };
	command._app = {
		wm: { getWorkspaceConfig: () => ({ config: { inner: () => ({ enterprise: { gesUrl } }) } }) },
		em: { getConfig: () => ({ gesUrl }), clearGesUrl: jest.fn() },
		rp: { getSourceDatas: () => sourceDatas },
		amp: { current: () => ({ logout: ampLogout }) },
	};
	command._commands = {
		storage: { removeSourceData: { do: removeSourceData } },
		workspace: { remove: { do: jest.fn() } },
		ai: { server: { removeAiData: { do: removeAiData } } },
	};
	return { removeSourceData, removeAiData, ampLogout };
};

describe("enterprise/logout", () => {
	beforeEach(() => mockEnterpriseLogout.mockReset());

	it("logs out of the app when the workspace has no GES source data", async () => {
		const { removeSourceData, removeAiData, ampLogout } = setup([]);

		await logout.do({ ctx: { cookie: {} } as unknown as Context, id: "/mnt/main" });

		expect(mockEnterpriseLogout).not.toHaveBeenCalled();
		expect(removeSourceData).not.toHaveBeenCalled();
		expect(removeAiData).toHaveBeenCalled();
		expect(ampLogout).toHaveBeenCalled();
	});

	it("logs out of GES and removes its source data when it exists", async () => {
		const source = { sourceType: "GitLab", domain: "enterprise.example.com", token: "t", userName: "u" };
		const { removeSourceData, ampLogout } = setup([source]);

		await logout.do({ ctx: { cookie: {} } as unknown as Context, id: "/mnt/ics-it" });

		expect(mockEnterpriseLogout).toHaveBeenCalledWith("t");
		expect(removeSourceData).toHaveBeenCalled();
		expect(ampLogout).toHaveBeenCalled();
	});
});
