import {
	AGENT_CHAT_PANEL_ID,
	setAgentChatHealthcheck,
	setAgentChatIsOpen,
	useAgentChatHealthcheckStore,
} from "@ext/agent/components/store/AgentChatIsOpenStore";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useFloatingPanelStore } from "@ui-kit/FloatingPanel";
import type { ReactNode } from "react";
import { AgentChatButton } from "./AgentChatButton";

type Conf = {
	enterprise: { gesUrl?: string };
	enterpriseCloud: { url?: string; enabled?: boolean };
};

let mockConf: Conf = { enterprise: {}, enterpriseCloud: {} };
let mockCloudHealthcheck = jest.fn();
let mockEnterpriseHealthcheck = jest.fn();

jest.mock("@ui-kit/GlassToolbar", () => {
	const React = require("react");
	return {
		GlassToolbar: ({ children }: { children: ReactNode }) => React.createElement("div", null, children),
		GlassToolbarIcon: () => null,
		GlassToolbarText: ({ children }: { children: ReactNode }) => React.createElement("span", null, children),
		GlassToolbarToggleButton: React.forwardRef(
			(
				{ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void },
				ref: React.Ref<HTMLButtonElement>,
			) => React.createElement("button", { disabled, onClick, ref, type: "button" }, children),
		),
	};
});

jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: {
		get value() {
			return { conf: mockConf };
		},
	},
}));

jest.mock("@core-ui/ContextServices/SourceDataService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: { value: [] },
}));

jest.mock("@ext/agent/components/hooks/useAgentChatVisibility", () => ({
	useAgentChatVisibility: () => ({ showToggle: true, showBrowserReveal: false }),
}));

jest.mock("@ext/enterprise/utils/getEnterpriseSourceData", () => ({
	getEnterpriseSourceData: () => ({ token: "ges-token" }),
}));

jest.mock("@ext/enterprise/EnterpriseApi", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: class {
		healthcheckAiAgent(token: string) {
			return mockEnterpriseHealthcheck(token);
		}
	},
}));

jest.mock("@ext/enterprise-cloud/GesCloudApi", () => ({
	GesCloudApi: class {
		healthcheckAiAgent() {
			return mockCloudHealthcheck();
		}
	},
}));

jest.mock("@ext/localization/locale/translate", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: (key: string) => key,
}));

const clickToggle = () => {
	render(require("react").createElement(AgentChatButton) as ReactNode);
	fireEvent.click(screen.getByRole("button"));
};

const healthcheck = () => useAgentChatHealthcheckStore.getState().healthcheck;
const isOpen = () => useFloatingPanelStore.getState().panels[AGENT_CHAT_PANEL_ID]?.isOpen ?? false;

describe("AgentChatButton", () => {
	beforeEach(() => {
		mockConf = { enterprise: {}, enterpriseCloud: {} };
		mockCloudHealthcheck = jest.fn();
		mockEnterpriseHealthcheck = jest.fn();
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
		useFloatingPanelStore.getState().registerPanel({ id: AGENT_CHAT_PANEL_ID, title: "Agent" });
		setAgentChatIsOpen(false);
		setAgentChatHealthcheck({ status: "idle" });
	});

	test("marks the agent available in the cloud when the backend reports it is up", async () => {
		mockConf.enterpriseCloud = { url: "https://cloud", enabled: true };
		mockCloudHealthcheck.mockResolvedValue({ available: true });

		clickToggle();

		expect(isOpen()).toBe(true);
		await waitFor(() => expect(healthcheck()).toEqual({ status: "available", target: "enterprise-cloud" }));
	});

	test("marks the cloud agent unavailable when the backend is down", async () => {
		mockConf.enterpriseCloud = { url: "https://cloud", enabled: true };
		mockCloudHealthcheck.mockResolvedValue({ available: false, reason: "unavailable" });

		clickToggle();

		await waitFor(() =>
			expect(healthcheck()).toEqual({ status: "unavailable", target: "enterprise-cloud", reason: "unavailable" }),
		);
		expect(isOpen()).toBe(true);
	});

	test("marks the cloud agent unavailable with a balance reason when the plan is out of balance", async () => {
		mockConf.enterpriseCloud = { url: "https://cloud", enabled: true };
		mockCloudHealthcheck.mockResolvedValue({ available: false, reason: "balance_empty" });

		clickToggle();

		await waitFor(() =>
			expect(healthcheck()).toEqual({
				status: "unavailable",
				target: "enterprise-cloud",
				reason: "balance_empty",
			}),
		);
	});

	test("checks GES with the enterprise token", async () => {
		mockConf.enterprise = { gesUrl: "https://ges" };
		mockEnterpriseHealthcheck.mockResolvedValue(true);

		clickToggle();

		await waitFor(() => expect(healthcheck()).toEqual({ status: "available", target: "enterprise" }));
		expect(mockEnterpriseHealthcheck).toHaveBeenCalledWith("ges-token");
	});

	test("marks the agent unavailable when the GES healthcheck fails", async () => {
		mockConf.enterprise = { gesUrl: "https://ges" };
		mockEnterpriseHealthcheck.mockResolvedValue(false);

		clickToggle();

		await waitFor(() => expect(healthcheck()).toEqual({ status: "unavailable", target: "enterprise" }));
	});

	test("does nothing outside GES and the cloud", async () => {
		clickToggle();

		expect(isOpen()).toBe(false);
		expect(healthcheck()).toEqual({ status: "idle" });
		expect(mockCloudHealthcheck).not.toHaveBeenCalled();
		expect(mockEnterpriseHealthcheck).not.toHaveBeenCalled();
	});

	test("ignores a second click while the healthcheck is running", async () => {
		mockConf.enterpriseCloud = { url: "https://cloud", enabled: true };
		let resolveHealthcheck: (value: { available: boolean; reason?: string }) => void = () => {};
		mockCloudHealthcheck.mockReturnValue(
			new Promise<{ available: boolean; reason?: string }>((resolve) => {
				resolveHealthcheck = resolve;
			}),
		);

		clickToggle();
		expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
		fireEvent.click(screen.getByRole("button"));

		expect(mockCloudHealthcheck).toHaveBeenCalledTimes(1);

		resolveHealthcheck({ available: true });
		await waitFor(() => expect(healthcheck()).toEqual({ status: "available", target: "enterprise-cloud" }));
	});
});
