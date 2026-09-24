import Date from "@components/Atoms/Date";
import { extractTextFromJSONContent } from "@core-ui/utils/extractTextFromJSONContent";
import t, { pluralize } from "@ext/localization/locale/translate";
import { Avatar, AvatarFallback, getAvatarFallback } from "@ui-kit/Avatar";
import { Indicator } from "@ui-kit/Indicator";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { BaseListItem } from "./BaseListItem";
import type { ReviewListItemProps } from "./ReviewListItem";

export const CommentListItem = ({ author, date, commentBlock, isRead, ...props }: ReviewListItemProps) => {
	const pluralized = pluralize(commentBlock?.answers?.length ?? 0, {
		one: t("comments.answers.one"),
		few: t("comments.answers.few"),
		many: t("comments.answers.many"),
	});

	return (
		<BaseListItem {...props}>
			<Avatar className="shrink-0 font-normal" size="2xs">
				<AvatarFallback uniqueId={author?.email}>{getAvatarFallback(author?.name ?? "")}</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex min-w-0 items-baseline gap-2 pr-4">
					<TextOverflowTooltip className="min-w-0 font-semibold text-primary-fg">
						{author?.name}
					</TextOverflowTooltip>
					<span className="shrink-0 text-xs font-normal text-muted">
						<Date date={date} />
					</span>
				</div>
				<TextOverflowTooltip className="line-clamp-2 w-full whitespace-normal text-xs font-normal text-primary-fg">
					{extractTextFromJSONContent(commentBlock?.comment?.content)}
				</TextOverflowTooltip>
				{(commentBlock?.answers?.length ?? 0) > 0 && (
					<span className="block text-xs font-normal text-muted">{pluralized}</span>
				)}
			</div>
			{!isRead && <Indicator className="absolute right-3 top-3 rounded-full bg-status-error" size="xs" />}
		</BaseListItem>
	);
};
