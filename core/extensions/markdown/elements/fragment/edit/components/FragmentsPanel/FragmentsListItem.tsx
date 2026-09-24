import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { MenuItem } from "@ui-kit/MenuItem";
import { FragmentsActions } from "./FragmentsActions";
import type { FragmentListItem } from "./types/constants";

type FragmentsListItemProps = {
	fragment: FragmentListItem;
	isSelected: boolean;
	onOpen: () => void;
	onRefresh: () => Promise<FragmentListItem[]>;
};

export const FragmentsListItem = ({ fragment, isSelected, onOpen, onRefresh }: FragmentsListItemProps) => (
	<MenuItem
		className={cn(
			"group/fragment w-full min-w-0 items-center gap-2 bg-transparent rounded-lg",
			"hover:bg-secondary-bg-hover data-[active=true]:bg-primary-bg-hover data-[active=true]:hover:bg-primary-bg-hover",
		)}
		data-active={isSelected}
		data-testid="fragment-row"
		onClick={onOpen}
	>
		<div className="flex min-w-0 flex-1 flex-col">
			<span className="truncate font-medium">{fragment.title || t("fragments-panel-untitled")}</span>
			<span className="line-clamp-2 text-muted text-xs font-normal">
				{fragment.description || t("fragments-panel-no-content")}
			</span>
		</div>
		<div className="flex size-6 shrink-0 items-center justify-center">
			<FragmentsActions fragment={fragment} onRefresh={onRefresh} />
		</div>
	</MenuItem>
);
