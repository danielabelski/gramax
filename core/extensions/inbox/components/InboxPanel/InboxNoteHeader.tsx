import Date from "@components/Atoms/Date";
import type { InboxArticle } from "@ext/inbox/models/types";
import t from "@ext/localization/locale/translate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { MenuItemIconButton } from "@ui-kit/MenuItem";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";

type InboxNoteHeaderProps = {
	note: InboxArticle;
	onDelete: (id: string) => void;
	onEdit: (note: InboxArticle) => void;
};

export const InboxNoteHeader = ({ note, onDelete, onEdit }: InboxNoteHeaderProps) => (
	<div className="flex min-w-0 items-center gap-2 h-5">
		<div className="flex min-w-0 flex-1 items-baseline gap-2">
			<TextOverflowTooltip className="min-w-0 font-medium text-sm">
				{note.title || t("article.no-name")}
			</TextOverflowTooltip>
			<Date className="shrink-0 text-xs text-muted font-normal" date={note.props.date ?? ""} />
		</div>
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<MenuItemIconButton icon="ellipsis" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={() => onEdit(note)}>
					<Icon icon="pencil" />
					{t("edit2")}
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => onDelete(note.id)} type="danger">
					<Icon icon="trash-2" />
					{t("delete")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	</div>
);
