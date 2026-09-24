import { useDeferApi } from "@core-ui/hooks/useApi";
import AgentSkillService from "@ext/agent/components/skills/AgentSkillService";
import { type AgentChatHealthcheck, useAgentChatHealthcheck } from "@ext/agent/components/store/AgentChatIsOpenStore";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import t from "@ext/localization/locale/translate";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@ui-kit/Alert";
import { memo, useCallback } from "react";
import { useChatInput } from "../store/ChatStore";
import { ChatInput } from "./ChatInput";

const SKILL_FETCH_OPTS = { consumeError: true } as const;

const getUnavailableText = ({ target, reason }: AgentChatHealthcheck) => {
	if (target === "enterprise-cloud") {
		if (reason === "balance_empty") {
			return {
				title: t("agent.availability-error.enterprise-cloud.balance-empty.title"),
				description: t("agent.availability-error.enterprise-cloud.balance-empty.description"),
			};
		}
		return {
			title: t("agent.availability-error.enterprise-cloud.title"),
			description: t("agent.availability-error.enterprise-cloud.description"),
		};
	}

	return {
		title: t("agent.availability-error.enterprise.title"),
		description: t("agent.availability-error.enterprise.description"),
	};
};

export const ChatFooter = memo(() => {
	const {
		attachments,
		inputDisabled,
		isSending,
		catalogName,
		selectedSkillName,
		browserAllowed,
		onAttachmentsChange,
		onSubmit,
		onCancel,
		onSkillChange,
		onBrowserAllowedChange,
	} = useChatInput();
	const healthcheck = useAgentChatHealthcheck();
	const unavailableText = healthcheck.status === "unavailable" ? getUnavailableText(healthcheck) : null;
	const healthcheckDisabled = healthcheck.status === "checking" || healthcheck.status === "unavailable";

	const { skills } = AgentSkillService.value;
	const { call: fetchSkillItems } = useDeferApi<ProviderItemProps[]>({ opts: SKILL_FETCH_OPTS });

	const handleSkillTagClick = useCallback(async () => {
		if (!selectedSkillName) return;

		let skill = Array.from(skills.values()).find((s) => s.title === selectedSkillName);

		if (!skill) {
			const items = await fetchSkillItems({ url: (api) => api.getArticleListInGramaxDir("agentSkill") });
			if (items) {
				AgentSkillService.setItems(items);
				skill = items.find((s) => s.title === selectedSkillName);
			}
		}

		if (skill) AgentSkillService.openItem(skill);
	}, [selectedSkillName, skills, fetchSkillItems]);

	return (
		<div className="shrink-0 pb-2 px-2">
			{unavailableText && (
				<Alert className="mb-2" focus="medium" status="warning">
					<AlertIcon icon="triangle-alert" />
					<AlertTitle>{unavailableText.title}</AlertTitle>
					<AlertDescription>{unavailableText.description}</AlertDescription>
				</Alert>
			)}
			<ChatInput
				attachments={attachments}
				browserAllowed={browserAllowed}
				catalogName={catalogName}
				disabled={inputDisabled || healthcheckDisabled}
				onAttachmentsChange={onAttachmentsChange}
				onBrowserAllowedChange={onBrowserAllowedChange}
				onCancel={onCancel ?? undefined}
				onSkillChange={onSkillChange}
				onSkillTagClick={handleSkillTagClick}
				onSubmit={onSubmit}
				selectedSkillName={selectedSkillName}
				sending={isSending}
			/>
		</div>
	);
});
