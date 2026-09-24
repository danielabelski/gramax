import { AGENT_CHAT_PANEL_ID } from "@ext/agent/components/store/AgentChatIsOpenStore";
import { AGENT_SKILLS_PANEL_ID } from "@ext/agent/components/types/constants";
import type { AgentSkill } from "@ext/agent/core/agentResourcesProvider";
import t from "@ext/localization/locale/translate";
import {
	DropdownMenuEmptyItem,
	DropdownMenuItem,
	DropdownMenuSearchItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	useSearchableMenu,
} from "@ui-kit/Dropdown";
import { useFloatingPanelStore, usePanelToggle } from "@ui-kit/FloatingPanel";
import { PANEL_GAP } from "@ui-kit/FloatingPanel/constants";
import { getPanelPositionByTrigger } from "@ui-kit/FloatingPanel/utils/getPanelPositionByTrigger";
import { Icon } from "@ui-kit/Icon";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { useMemo } from "react";

type ChatSkillsMenuProps = {
	skills: AgentSkill[];
	isLoading: boolean;
	selectedSkillName: string | null;
	onSkillChange: (name: string | null) => void;
	onClose: () => void;
};

export const ChatSkillsMenu = ({
	skills,
	isLoading,
	selectedSkillName,
	onSkillChange,
	onClose,
}: ChatSkillsMenuProps) => {
	const { open } = usePanelToggle(AGENT_SKILLS_PANEL_ID);
	const panelSize = useFloatingPanelStore((state) => state.panels[AGENT_SKILLS_PANEL_ID]?.size);
	const { search, setSearch, contentRef, inputRef, handleContentKeyDown, handleInputKeyDown, filterItems } =
		useSearchableMenu();
	const unnamedSkillLabel = t("agent.skills.unnamed-skill");
	const filteredSkills = useMemo(
		() =>
			filterItems(
				skills.map((skill, index) => {
					const name = skill.name?.trim();
					return {
						...skill,
						key: `${name || "unnamed"}-${index}`,
						label: name || unnamedSkillLabel,
						name,
					};
				}),
			),
		[filterItems, skills, unnamedSkillLabel],
	);

	const handleManageSkills = () => {
		const agentPanel = document.querySelector<HTMLElement>(`[data-floating-panel-id="${AGENT_CHAT_PANEL_ID}"]`);
		if (agentPanel && panelSize) {
			const placement = getPanelPositionByTrigger({
				gap: PANEL_GAP,
				panelSize,
				trigger: agentPanel.getBoundingClientRect(),
				viewport: { height: window.innerHeight, width: window.innerWidth },
			});
			open(placement);
		} else {
			open();
		}
		onClose();
	};

	return (
		<DropdownMenuSub onOpenChange={(open) => !open && setSearch("")}>
			<DropdownMenuSubTrigger>
				<Icon icon="scroll-text" />
				{t("agent.skills.menu-name")}
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent onKeyDown={handleContentKeyDown} ref={contentRef} sideOffset={8}>
				<DropdownMenuSearchItem
					onChange={(e) => setSearch(e.target.value)}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={handleInputKeyDown}
					placeholder={t("agent.skills.search-placeholder")}
					ref={inputRef}
					value={search}
				/>
				<DropdownMenuSeparator />
				<div className="max-h-64 overflow-y-auto">
					{skills.length === 0 && isLoading ? (
						<DropdownMenuItem disabled>{t("agent.skills.loading")}</DropdownMenuItem>
					) : filteredSkills.length === 0 ? (
						<DropdownMenuEmptyItem className="max-w-56 py-3.5">
							{t("agent.skills.no-skills")}
						</DropdownMenuEmptyItem>
					) : (
						filteredSkills.map((skill) => {
							const isSelected = Boolean(skill.name) && selectedSkillName === skill.name;
							return (
								<DropdownMenuItem
									disabled={!skill.name || !skill.content}
									key={skill.key}
									onSelect={() => skill.name && onSkillChange(isSelected ? null : skill.name)}
									textValue={skill.label}
								>
									<TextOverflowTooltip className="truncate whitespace-nowrap">
										{skill.label}
									</TextOverflowTooltip>
								</DropdownMenuItem>
							);
						})
					)}
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={handleManageSkills}>
					<Icon icon="settings" />
					{t("agent.skills.manage")}
				</DropdownMenuItem>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
};
