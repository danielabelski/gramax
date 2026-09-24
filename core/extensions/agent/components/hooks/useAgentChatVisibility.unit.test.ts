import { act, renderHook, waitFor } from "@testing-library/react";
import { useAgentChatVisibility } from "./useAgentChatVisibility";

type Conf = {
	enterprise?: { gesUrl?: string };
	enterpriseCloud?: { url?: string; enabled?: boolean };
};

let mockPlatform = { isWeb: true, isTauri: false };
let mockConf: Conf = {};
let mockAiData: { aiApiUrl?: string; aiToken?: string } | undefined;
let mockWorkspacePath = "workspace";
let mockCanEditCatalog = true;

jest.mock("@core-ui/hooks/usePlatform", () => ({
	usePlatform: () => mockPlatform,
}));

jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: {
		get value() {
			return { conf: mockConf };
		},
	},
}));

jest.mock("@core-ui/ContextServices/Workspace", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: {
		current: () => ({
			get path() {
				return mockWorkspacePath;
			},
		}),
	},
}));

jest.mock("@ext/workspace/components/useWorkspaceAi", () => ({
	useWorkspaceAi: () => ({ getData: async () => mockAiData }),
}));

jest.mock("@ext/security/logic/Permission/components/PermissionService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { useCheckPermission: () => mockCanEditCatalog },
}));

const renderShowToggle = async (expected: boolean) => {
	const { result } = renderHook(() => useAgentChatVisibility());
	await act(async () => {
		await Promise.resolve();
	});
	if (expected) await waitFor(() => expect(result.current.showToggle).toBe(true));
	else expect(result.current.showToggle).toBe(false);
	return result;
};

describe("useAgentChatVisibility", () => {
	beforeEach(() => {
		mockPlatform = { isWeb: true, isTauri: false };
		mockConf = {};
		mockAiData = undefined;
		mockWorkspacePath = `workspace-${Math.random()}`;
		mockCanEditCatalog = true;
		window.localStorage.clear();
	});

	test("shows the toggle in GES Cloud", async () => {
		mockConf = { enterpriseCloud: { url: "https://cloud", enabled: true } };

		await renderShowToggle(true);
	});

	test("hides the toggle when the cloud session is disabled", async () => {
		mockConf = { enterpriseCloud: { url: "https://cloud", enabled: false } };

		await renderShowToggle(false);
	});

	test("hides the toggle when the cloud url is missing", async () => {
		mockConf = { enterpriseCloud: { enabled: true } };

		await renderShowToggle(false);
	});

	test("hides the toggle in GES until the AI server credentials arrive", async () => {
		mockConf = { enterprise: { gesUrl: "https://ges" } };

		await renderShowToggle(false);
	});

	test("shows the toggle in GES once the AI server credentials arrive", async () => {
		mockConf = { enterprise: { gesUrl: "https://ges" } };
		mockAiData = { aiApiUrl: "https://ai", aiToken: "token" };

		await renderShowToggle(true);
	});

	test("hides the toggle in GES without the editor role", async () => {
		mockConf = { enterprise: { gesUrl: "https://ges" } };
		mockAiData = { aiApiUrl: "https://ai", aiToken: "token" };
		mockCanEditCatalog = false;

		await renderShowToggle(false);
	});

	test("shows the toggle in GES Cloud without the editor role", async () => {
		mockConf = { enterpriseCloud: { url: "https://cloud", enabled: true } };
		mockCanEditCatalog = false;

		await renderShowToggle(true);
	});

	test("hides the toggle outside GES and the cloud", async () => {
		mockAiData = { aiApiUrl: "https://ai", aiToken: "token" };

		await renderShowToggle(false);
	});

	test("hides the toggle where there is no editor", async () => {
		mockPlatform = { isWeb: false, isTauri: false };
		mockConf = { enterpriseCloud: { url: "https://cloud", enabled: true } };

		await renderShowToggle(false);
	});
});
