import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { MenuItem } from "@ui-kit/MenuItem";
import { TemplateActions } from "./TemplateActions";
import type { TemplateItemProps } from "./types/constants";

type TemplatesListItemProps = {
	template: TemplateItemProps;
	isSelected: boolean;
	onOpen: () => void;
	onRefresh: () => Promise<TemplateItemProps[]>;
};

export const TemplatesListItem = ({ template, isSelected, onOpen, onRefresh }: TemplatesListItemProps) => (
	<MenuItem
		className={cn(
			"group/template w-full min-w-0 items-center gap-2 bg-transparent rounded-lg",
			"hover:bg-secondary-bg-hover data-[active=true]:bg-primary-bg-hover data-[active=true]:hover:bg-primary-bg-hover",
		)}
		data-active={isSelected}
		data-testid="template-row"
		onClick={onOpen}
	>
		<div className="flex min-w-0 flex-1 flex-col">
			<span className="truncate font-medium">{template.title || t("templates-panel-untitled")}</span>
			<span className="line-clamp-2 text-muted text-xs font-normal">
				{template.description || t("templates-panel-no-content")}
			</span>
		</div>
		<div className="flex size-6 shrink-0 items-center justify-center">
			<TemplateActions onRefresh={onRefresh} template={template} />
		</div>
	</MenuItem>
);
