import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import EditMarkdownTrigger from "@ext/article/actions/EditMarkdownTrigger";
import t from "@ext/localization/locale/translate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { useCallback } from "react";

type AgentSkillActionsProps = {
	id: string;
	onDelete: (id: string) => void;
	onMarkdownChange: (id: string, markdown: string) => void;
	className?: string;
};

export const AgentSkillActions = ({ id, onDelete, onMarkdownChange, className }: AgentSkillActionsProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;

	const loadContent = useCallback(async () => {
		const response = await FetchService.fetch(apiUrlCreator.getFileContentInGramaxDir(id, "agentSkill"));
		return response.ok ? response.text() : "";
	}, [id]);

	const saveContent = useCallback(
		async (content: string) => {
			const response = await FetchService.fetch(
				apiUrlCreator.updateFileInGramaxDir(id, "agentSkill"),
				JSON.stringify({ content }),
			);
			if (response.ok) onMarkdownChange(id, content);
		},
		[id, onMarkdownChange],
	);

	const handleDelete = useCallback(async () => {
		if (!confirm(t("confirm-agent-skills-delete"))) return;
		const response = await FetchService.fetch(apiUrlCreator.removeFileInGramaxDir(id, "agentSkill"));
		if (response.ok) onDelete(id);
	}, [id, onDelete]);

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<FloatingTriggerButton
					aria-label={t("actions")}
					className={className}
					onClick={(event) => event.stopPropagation()}
				>
					<Icon icon="ellipsis" size="sm" />
				</FloatingTriggerButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<EditMarkdownTrigger
					isCurrentItem
					isTemplate={false}
					loadContent={loadContent}
					saveContent={saveContent}
				/>
				<DropdownMenuItem onSelect={() => void handleDelete()} type="danger">
					<Icon icon="trash-2" />
					{t("delete")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
