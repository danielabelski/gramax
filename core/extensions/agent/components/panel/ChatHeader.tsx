import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import { useDeferApi } from "@core-ui/hooks/useApi";
import { useAgentChatVisibility } from "@ext/agent/components/hooks/useAgentChatVisibility";
import { ChatDropdown } from "@ext/agent/components/panel/ChatDropdown";
import { useActiveSessionBrowser } from "@ext/agent/components/store/AgentStore";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { FloatingIconButton } from "@ui-kit/FloatingPanel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { memo, useCallback } from "react";
import { useChatHeaderActions } from "../store/ChatStore";

export const ChatHeader = memo(() => {
	const { sessions, activeSessionId, onSelectSession, onCloseTab, onRenameSession, onNewSession } =
		useChatHeaderActions();
	const browser = useActiveSessionBrowser();
	const { showBrowserReveal } = useAgentChatVisibility();
	const { call: callReveal } = useDeferApi({});

	const handleReveal = useCallback(() => {
		if (!activeSessionId) return Promise.resolve();

		return callReveal({
			url: (api) => api.getAgentBrowserRevealUrl(activeSessionId),
			opts: {
				method: Method.POST,
				mime: MimeTypes.json,
				consumeError: true,
			},
		});
	}, [activeSessionId, callReveal]);

	return (
		<>
			{showBrowserReveal && browser?.active && (
				<Tooltip>
					<TooltipTrigger asChild>
						<FloatingIconButton icon="globe" onClick={() => void handleReveal()} />
					</TooltipTrigger>
					<TooltipContent>{t("agent.browser.tooltip")}</TooltipContent>
				</Tooltip>
			)}
			<Button className="text-muted" onClick={onNewSession} size="xs" startIcon="square-pen" variant="ghost">
				{t("agent.tooltips.new-chat")}
			</Button>
			<ChatDropdown
				activeId={activeSessionId}
				onClose={onCloseTab}
				onRename={onRenameSession}
				onSelect={onSelectSession}
				sessions={sessions}
			/>
		</>
	);
});
