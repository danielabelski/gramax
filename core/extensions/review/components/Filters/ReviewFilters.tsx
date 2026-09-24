import t from "@ext/localization/locale/translate";
import { ReviewAuthorsFilter } from "@ext/review/components/Filters/ReviewAuthorsFilter";
import { ReviewDateFilter } from "@ext/review/components/Filters/ReviewDateFilter";
import { ReviewScopeTabs } from "@ext/review/components/Filters/ReviewScopeTabs";
import { useReviewStore } from "@ext/review/logic/store/ReviewStore";
import { Button } from "@ui-kit/Button";
import { Divider } from "@ui-kit/Divider";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { Indicator } from "@ui-kit/Indicator";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-kit/Popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useMemo, useState } from "react";

export const ReviewFilters = () => {
	const [isOpen, setIsOpen] = useState(false);
	const { filters, setFilters } = useReviewStore((s) => ({
		filters: s.filters,
		setFilters: s.setFilters,
	}));

	const hasActiveFilters = useMemo(
		() => Boolean(filters.afterDate || filters.beforeDate || filters.authors?.length),
		[filters.afterDate, filters.beforeDate, filters.authors],
	);

	return (
		<Popover modal={false} onOpenChange={setIsOpen} open={isOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<FloatingTriggerButton
							aria-label={t("editor.modes.filters.title")}
							className="relative"
							data-state={isOpen ? "open" : "closed"}
							size="sm"
						>
							<Icon className="h-3.5 w-3.5" icon="filter" />
							{hasActiveFilters && (
								<Indicator className="absolute right-1 top-1 rounded-full bg-status-info" size="sm" />
							)}
						</FloatingTriggerButton>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>{t("editor.modes.filters.title")}</TooltipContent>
			</Tooltip>
			<PopoverContent align="start" className="overflow-hidden p-0">
				<div className="flex items-center justify-between px-3 py-2.5">
					<span className="font-semibold">{t("editor.modes.filters.title")}</span>
					<Button
						className="h-auto p-1 text-xs text-muted font-normal"
						onClick={() => setFilters({})}
						size="xs"
						variant="text"
					>
						{t("editor.modes.filters.reset")}
					</Button>
				</div>
				<Divider />
				<div className="space-y-4 px-2 py-2">
					<ReviewScopeTabs />

					<ReviewDateFilter
						onChange={(value) =>
							setFilters({
								...filters,
								afterDate: value.from?.toISOString(),
								beforeDate: value.to?.toISOString(),
							})
						}
						value={{
							from: filters.afterDate ? new Date(filters.afterDate) : null,
							to: filters.beforeDate ? new Date(filters.beforeDate) : null,
						}}
					/>

					<ReviewAuthorsFilter
						onChange={(emails) => setFilters({ ...filters, authors: emails })}
						selectedEmails={filters.authors ?? null}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
};
