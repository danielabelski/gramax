import { useFloatingPanelStore } from "@ui-kit/FloatingPanel";
import { create } from "zustand";

export const AGENT_CHAT_PANEL_ID = "agent-chat";

export type AgentChatTarget = "enterprise" | "enterprise-cloud";
export type AgentChatHealthcheckStatus = "idle" | "checking" | "available" | "unavailable";

export type AgentChatHealthcheckReason = "balance_empty" | "unavailable";

export interface AgentChatHealthcheck {
	status: AgentChatHealthcheckStatus;
	target?: AgentChatTarget;
	reason?: AgentChatHealthcheckReason;
}

interface AgentChatHealthcheckState {
	healthcheck: AgentChatHealthcheck;
	setHealthcheck: (healthcheck: AgentChatHealthcheck) => void;
}

export const useAgentChatHealthcheckStore = create<AgentChatHealthcheckState>()((set) => ({
	healthcheck: { status: "idle" },
	setHealthcheck: (healthcheck) => set({ healthcheck }),
}));

export const useAgentChatIsOpen = () =>
	useFloatingPanelStore((state) => state.panels[AGENT_CHAT_PANEL_ID]?.isOpen ?? false);

export const useAgentChatHealthcheck = () => useAgentChatHealthcheckStore((state) => state.healthcheck);

export const setAgentChatIsOpen = (isOpen: boolean) =>
	useFloatingPanelStore.getState().setIsOpen(AGENT_CHAT_PANEL_ID, isOpen);

export const setAgentChatHealthcheck = (healthcheck: AgentChatHealthcheck) =>
	useAgentChatHealthcheckStore.getState().setHealthcheck(healthcheck);
