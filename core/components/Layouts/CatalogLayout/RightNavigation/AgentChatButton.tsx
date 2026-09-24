import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import SourceDataService from "@core-ui/ContextServices/SourceDataService";
import { useBreakpointAtLeast } from "@core-ui/hooks/useBreakpoint";
import { useAgentChatVisibility } from "@ext/agent/components/hooks/useAgentChatVisibility";
import {
	AGENT_CHAT_PANEL_ID,
	type AgentChatHealthcheckReason,
	type AgentChatTarget,
	setAgentChatHealthcheck,
	useAgentChatHealthcheck,
} from "@ext/agent/components/store/AgentChatIsOpenStore";
import EnterpriseApi from "@ext/enterprise/EnterpriseApi";
import { getEnterpriseSourceData } from "@ext/enterprise/utils/getEnterpriseSourceData";
import { GesCloudApi } from "@ext/enterprise-cloud/GesCloudApi";
import t from "@ext/localization/locale/translate";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import { GlassToolbar, GlassToolbarIcon, GlassToolbarText, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { useCallback, useRef } from "react";

export const AgentChatButton = () => {
	const { showToggle } = useAgentChatVisibility();
	const isLabelVisible = useBreakpointAtLeast("md");
	const sourceDatas = SourceDataService.value;
	const { status: healthcheckStatus } = useAgentChatHealthcheck();
	const { enterprise, enterpriseCloud } = PageDataContextService.value.conf;
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { isOpen, open, close } = usePanelToggle(AGENT_CHAT_PANEL_ID, triggerRef);

	const toggleAgentChat = useCallback(async () => {
		if (isOpen) {
			close();
			return;
		}

		if (healthcheckStatus === "checking") {
			open();
			return;
		}

		const target: AgentChatTarget | null = enterprise.gesUrl
			? "enterprise"
			: enterpriseCloud.enabled && enterpriseCloud.url
				? "enterprise-cloud"
				: null;
		if (!target) return;

		setAgentChatHealthcheck({ status: "checking", target });
		open();

		let available = false;
		let reason: AgentChatHealthcheckReason | undefined;
		try {
			if (target === "enterprise") {
				const token = getEnterpriseSourceData(sourceDatas ?? [], enterprise.gesUrl)?.token ?? "";
				available = await new EnterpriseApi(enterprise.gesUrl).healthcheckAiAgent(token);
			} else if (target === "enterprise-cloud") {
				const result = await new GesCloudApi(enterpriseCloud.url).healthcheckAiAgent();
				available = result.available;
				if (result.available === false) reason = result.reason;
			}
		} catch {
			available = false;
		}

		setAgentChatHealthcheck({ status: available ? "available" : "unavailable", target, reason });
	}, [enterprise.gesUrl, enterpriseCloud.enabled, enterpriseCloud.url, healthcheckStatus, isOpen, open, close]);
	if (!showToggle) return null;

	return (
		<GlassToolbar className="rounded-full" variant="single">
			<GlassToolbarToggleButton
				active={isOpen}
				aria-label={t("agent.tooltips.toggle-chat")}
				disabled={healthcheckStatus === "checking"}
				onClick={() => void toggleAgentChat()}
				ref={triggerRef}
				tooltipText={isLabelVisible ? undefined : t("agent.tooltips.toggle-chat")}
			>
				<GlassToolbarIcon icon="sparkles" />
				<GlassToolbarText className="hidden md:inline text-xs font-medium">AI Agent</GlassToolbarText>
			</GlassToolbarToggleButton>
		</GlassToolbar>
	);
};
