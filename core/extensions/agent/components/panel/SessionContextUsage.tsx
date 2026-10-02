import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { agentLlmConfig } from "@ext/agent/llm/agentLlmConfig";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { ProgressCircle } from "@ui-kit/ProgressCircle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useActiveSessionUsage } from "../store/AgentStore";
import { formatTokenCount } from "../utils/formatUsage";

const openModal = () => {
	const id = ModalToOpenService.addModal(ModalToOpen.AgentContextUsageModal, {
		onClose: () => ModalToOpenService.removeModal(id),
	});
};

type Props = {
	// True the instant the user hits send, before any request has round-tripped.
	// contextWindowTokens alone would only appear after the first poll picks up
	// what the backend stamped at turn start — this makes the ring appear with
	// zero latency instead of waiting on that round trip.
	sending?: boolean;
};

export const SessionContextUsage = ({ sending }: Props) => {
	const usage = useActiveSessionUsage();
	if (!sending && !usage?.contextWindowTokens) return null;

	const contextWindowTokens = usage?.contextWindowTokens || agentLlmConfig.contextWindowTokens;
	const percent = usage?.contextUsagePercent ?? 0;
	const usedPercent = Math.round(percent);
	const leftPercent = Math.round(100 - percent);

	return (
		<Tooltip>
			<TooltipTrigger className="cursor-default [&_svg]:size-4 [&_path]:fill-primary-border">
				<ProgressCircle size="xs" value={percent} />
			</TooltipTrigger>
			<TooltipContent className="px-3 pb-3 pt-2.5" collisionPadding={8} side="bottom">
				<div className="flex flex-col items-start gap-1">
					<span className="text-sm font-medium text-inverse-primary-fg">
						{t("agent.usage.tooltip-title")}
					</span>
					<div className="flex flex-col">
						<span className="text-inverse-secondary-fg text-xs">
							{t("agent.usage.tooltip-percent")
								.replace("{{used}}", String(usedPercent))
								.replace("{{left}}", String(leftPercent))}
						</span>
						<span className="text-inverse-secondary-fg text-xs">
							{t("agent.usage.tooltip-tokens")
								.replace("{{used}}", formatTokenCount(usage?.contextTokensUsed ?? 0))
								.replace("{{total}}", formatTokenCount(contextWindowTokens))}
						</span>
					</div>
					<Button
						className="p-0 h-5 text-inverse-muted lg:hover:text-inverse-primary-fg"
						onClick={openModal}
						size="xs"
						variant="link"
					>
						{t("agent.usage.tooltip-view-context")}
					</Button>
				</div>
			</TooltipContent>
		</Tooltip>
	);
};
