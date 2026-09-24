import type { ReactElement } from "react";
import { useAgentChatPanel } from "./hooks/useAgentChatPanel";

const AgentChatPanelController = (): null => {
	useAgentChatPanel();
	return null;
};

const AgentChatService = {
	Init: (): ReactElement => <AgentChatPanelController />,
};

export default AgentChatService;
