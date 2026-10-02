import InputFile from "@components/Atoms/InputFile";
import { RequestStatus, useApi } from "@core-ui/hooks/useApi";
import type { AgentSkill } from "@ext/agent/core/agentResourcesProvider";
import t from "@ext/localization/locale/translate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { type ChangeEventHandler, useState } from "react";
import { ChatSkillsMenu } from "./ChatSkillsMenu";

type SkillsListResponse = { skills: AgentSkill[] };

type Props = {
	catalogName: string | null;
	selectedSkillName: string | null;
	onSkillChange: (name: string | null) => void;
	onFileChange: ChangeEventHandler<HTMLInputElement>;
};

const ChatToolsMenu = ({ catalogName, selectedSkillName, onSkillChange, onFileChange }: Props) => {
	const [open, setOpen] = useState(false);
	const {
		data: skills,
		status,
		call: refetchSkills,
	} = useApi<SkillsListResponse, AgentSkill[]>({
		url: (api) => api.getAgentSkillsListUrl(catalogName),
		map: (data) => data?.skills ?? [],
		opts: { consumeError: true },
	});

	const skillList = skills ?? [];
	const isLoading = status === RequestStatus.Init || status === RequestStatus.Loading;

	const handleFileChange: ChangeEventHandler<HTMLInputElement> = (e) => {
		setOpen(false);
		onFileChange(e);
	};

	return (
		<DropdownMenu
			onOpenChange={(next) => {
				if (next) void refetchSkills();
				setOpen(next);
			}}
			open={open}
		>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="inline-flex">
						<DropdownMenuTrigger asChild>
							<FloatingTriggerButton aria-label={t("agent.tooltips.add")} className="size-7">
								<Icon className="h-4 w-4" icon="plus" />
							</FloatingTriggerButton>
						</DropdownMenuTrigger>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("agent.tooltips.add")}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start" side="top">
				<InputFile className="w-full" onChange={handleFileChange}>
					<DropdownMenuItem onSelect={(e) => e.preventDefault()}>
						<Icon icon="paperclip" />
						{t("agent.skills.attach-file")}
					</DropdownMenuItem>
				</InputFile>
				<ChatSkillsMenu
					isLoading={isLoading}
					onClose={() => setOpen(false)}
					onSkillChange={onSkillChange}
					selectedSkillName={selectedSkillName}
					skills={skillList}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { ChatToolsMenu };
