import { AGENT_CHAT_PANEL_ID } from "@ext/agent/components/store/AgentChatIsOpenStore";
import t from "@ext/localization/locale/translate";
import { FloatingPanel } from "@ui-kit/FloatingPanel";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { ChatHeader } from "./ChatHeader";
import { ChatShell } from "./ChatShell";

export const AgentChatPanel = () => {
	return (
		<ComponentVariantProvider variant="glass">
			<FloatingPanel
				headerActions={<ChatHeader />}
				icon="sparkles"
				id={AGENT_CHAT_PANEL_ID}
				title={t("agent.panel-name")}
			>
				<ChatShell />
			</FloatingPanel>
		</ComponentVariantProvider>
	);
};
