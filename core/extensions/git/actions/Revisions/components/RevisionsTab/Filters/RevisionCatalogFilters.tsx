import { RevisionArticlesFilter } from "@ext/git/actions/Revisions/components/RevisionsTab/Filters/RevisionArticlesFilter";
import { RevisionAuthorsFilter } from "@ext/git/actions/Revisions/components/RevisionsTab/Filters/RevisionAuthorsFilter";
import { RevisionDateFilter } from "@ext/git/actions/Revisions/components/RevisionsTab/Filters/RevisionDateFilter";
import { useRevisionCatalogStore } from "@ext/git/actions/Revisions/logic/store/RevisionCatalogStore";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { Divider } from "@ui-kit/Divider";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { Indicator } from "@ui-kit/Indicator";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-kit/Popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

export const RevisionCatalogFilters = memo(({ panelOpen }: { panelOpen: boolean }) => {
	const [isOpen, setIsOpen] = useState(false);
	const { filter, setFilter } = useRevisionCatalogStore((state) => ({
		filter: state.filter,
		setFilter: state.setFilter,
	}));

	const hasActiveFilters = useMemo(
		() => Boolean(filter?.authors?.length || filter?.afterDate || filter?.beforeDate || filter?.articles?.length),
		[filter],
	);

	const articlePathspecs = useMemo(() => filter?.articles?.map((article) => article.path), [filter?.articles]);

	const dateRange: DateRange = useMemo(
		() => ({
			from: filter?.afterDate ? new Date(filter.afterDate) : undefined,
			to: filter?.beforeDate ? new Date(filter.beforeDate) : undefined,
		}),
		[filter?.afterDate, filter?.beforeDate],
	);

	const handleOpenChange = useCallback((open: boolean) => setIsOpen(open), []);

	useEffect(() => {
		if (!panelOpen && isOpen) setIsOpen(false);
	}, [panelOpen, isOpen]);

	return (
		<Popover modal={false} onOpenChange={handleOpenChange} open={isOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<FloatingTriggerButton
							aria-label={t("git.history.filters.title")}
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
				<TooltipContent>{t("git.history.filters.title")}</TooltipContent>
			</Tooltip>
			<PopoverContent align="start" className="overflow-hidden p-0">
				<div className="flex items-center justify-between px-3 py-2.5">
					<span className="font-semibold">{t("git.history.filters.title")}</span>
					<Button
						className="h-auto p-1 text-xs text-muted font-normal"
						onClick={() => setFilter(null)}
						size="xs"
						variant="text"
					>
						{t("git.history.filters.reset")}
					</Button>
				</div>
				<Divider />
				<div className="space-y-4 px-2 py-2">
					<RevisionDateFilter
						onChange={(value) =>
							setFilter({
								...filter,
								afterDate: value.from?.toISOString(),
								beforeDate: value.to?.toISOString(),
							})
						}
						pathspecs={articlePathspecs}
						value={dateRange}
					/>
					{!!filter?.articles?.length && (
						<RevisionArticlesFilter
							articles={filter.articles}
							onChange={(articles) => setFilter({ ...filter, articles })}
						/>
					)}
					<RevisionAuthorsFilter
						onChange={(emails) => setFilter({ ...filter, authors: emails })}
						pathspecs={articlePathspecs}
						selectedEmails={filter?.authors ?? null}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
});
