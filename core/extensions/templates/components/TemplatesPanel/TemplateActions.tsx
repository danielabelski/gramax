import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import EditMarkdownTrigger from "@ext/article/actions/EditMarkdownTrigger";
import DeleteItem from "@ext/item/actions/DeleteItem";
import t from "@ext/localization/locale/translate";
import TemplateService from "@ext/templates/components/TemplateService";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import type { MouseEvent } from "react";
import type { TemplateItemProps } from "./types/constants";

type TemplateActionsProps = {
	template: TemplateItemProps;
	onRefresh: () => Promise<TemplateItemProps[]>;
};

export const TemplateActions = ({ template, onRefresh }: TemplateActionsProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { selectedID } = TemplateService.value;

	const loadContent = async () => {
		const response = await FetchService.fetch(apiUrlCreator.getFileContentInGramaxDir(template.id, "template"));
		if (response.ok) return await response.json();
	};

	const saveContent = async (content: string) => {
		await FetchService.fetch(
			apiUrlCreator.updateFileInGramaxDir(template.id, "template"),
			JSON.stringify({ content }),
		);
		const templates = await onRefresh();
		if (selectedID !== template.id) return;

		const refreshedTemplate = templates.find((item) => item.id === template.id);
		if (refreshedTemplate) TemplateService.openItem(refreshedTemplate);
	};

	const deleteTemplate = async () => {
		if (!confirm(t("confirm-templates-delete"))) return;

		await FetchService.fetch(apiUrlCreator.removeFileInGramaxDir(template.id, "template"));
		if (selectedID === template.id) TemplateService.closeItem();
		await onRefresh();
	};

	const stopRowClick = (event: MouseEvent<HTMLDivElement>) => event.stopPropagation();

	return (
		<div onClick={stopRowClick}>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<FloatingTriggerButton
						aria-label={t("templates-panel-actions")}
						className="opacity-0 transition-opacity group-hover/template:opacity-100 data-[state=open]:opacity-100"
					>
						<Icon icon="ellipsis" />
					</FloatingTriggerButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<EditMarkdownTrigger
						isCurrentItem
						isTemplate={false}
						loadContent={loadContent}
						saveContent={saveContent}
					/>
					<DeleteItem onConfirm={() => void deleteTemplate()} />
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
