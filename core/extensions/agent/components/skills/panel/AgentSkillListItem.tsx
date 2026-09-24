import { cn } from "@core-ui/utils/cn";
import type { AgentSkillListItem as AgentSkillListItemType } from "@ext/agent/components/utils/skillListUtils";
import t from "@ext/localization/locale/translate";
import { MenuItem } from "@ui-kit/MenuItem";
import { AgentSkillActions } from "./AgentSkillActions";

type AgentSkillListItemProps = {
	item: AgentSkillListItemType;
	isSelected: boolean;
	onClick: (id: string) => void;
	onDelete: (id: string) => void;
	onMarkdownChange: (id: string, markdown: string) => void;
};

export const AgentSkillListItem = ({
	item,
	isSelected,
	onClick,
	onDelete,
	onMarkdownChange,
}: AgentSkillListItemProps) => (
	<MenuItem
		className={cn(
			"group/skill w-full min-w-0 items-center gap-2 rounded-lg bg-transparent hover:bg-secondary-border",
			isSelected && "bg-secondary-border",
		)}
		data-testid="agent-skill-row"
		onClick={() => onClick(item.id)}
	>
		<div className="flex min-w-0 flex-1 flex-col">
			<div className="truncate font-semibold">{item.title || t("article.no-name")}</div>
			<div className="line-clamp-2 text-xs font-normal text-secondary-fg">
				{item.description || t("agent.skills.no-content")}
			</div>
		</div>
		<div className="flex size-6 shrink-0 items-center justify-center" onClick={(event) => event.stopPropagation()}>
			<AgentSkillActions
				className="opacity-0 transition-opacity group-hover/skill:opacity-100 data-[state=open]:opacity-100"
				id={item.id}
				onDelete={onDelete}
				onMarkdownChange={onMarkdownChange}
			/>
		</div>
	</MenuItem>
);
