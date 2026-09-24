import t from "@ext/localization/locale/translate";
import { useScopedItems } from "@ext/review/logic/hooks/useScopedItems";
import { markItemAsRead } from "@ext/review/logic/store/ReviewNotificationsStore";
import { useReviewStore } from "@ext/review/logic/store/ReviewStore";
import { FloatingIconButton } from "@ui-kit/FloatingPanel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useCallback } from "react";

export const ReviewOptions = () => {
	const scope = useReviewStore((s) => s.currentScope);
	const items = useReviewStore((s) => (scope === "catalog" ? s.catalogItems : s.articleItems));
	const { unreadCount } = useScopedItems(scope);

	const markAsRead = useCallback(() => {
		if (!items) return;

		items.forEach((item) => {
			markItemAsRead(item.id);
		});
	}, [items]);

	return (
		<div className="relative">
			<Tooltip>
				<TooltipTrigger asChild>
					<FloatingIconButton icon="big-check2" onClick={markAsRead} size="sm" />
				</TooltipTrigger>
				<TooltipContent>{t("editor.modes.mark-as-read")}</TooltipContent>
			</Tooltip>
			{unreadCount > 0 && (
				<span className="pointer-events-none absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-status-error px-1 text-center text-[10px] font-semibold leading-4 text-white">
					{unreadCount}
				</span>
			)}
		</div>
	);
};
