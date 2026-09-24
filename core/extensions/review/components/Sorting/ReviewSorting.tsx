import t from "@ext/localization/locale/translate";
import { type ReviewGrouping, type ReviewSortingOrder, useReviewStore } from "@ext/review/logic/store/ReviewStore";
import type { ReviewScope } from "@ext/review/models/ReviewList";
import { Divider } from "@ui-kit/Divider";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { Label } from "@ui-kit/Label";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-kit/Popover";
import { RadioGroup, RadioGroupItem } from "@ui-kit/RadioGroup";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useCallback, useState } from "react";

const GROUPING_OPTIONS: { value: ReviewGrouping; label: string; scope?: ReviewScope }[] = [
	{ value: "none", label: "editor.modes.grouping.none" },
	{ value: "article", label: "editor.modes.grouping.article", scope: "catalog" },
	{ value: "date", label: "editor.modes.grouping.date" },
];

const SORT_OPTIONS: { value: ReviewSortingOrder; label: string }[] = [
	{ value: "newest", label: "editor.modes.sorting.newest" },
	{ value: "oldest", label: "editor.modes.sorting.oldest" },
];

export const ReviewSorting = () => {
	const [isOpen, setIsOpen] = useState(false);
	const { sorting, setSorting, grouping, setGrouping, currentScope } = useReviewStore((s) => ({
		sorting: s.sorting,
		setSorting: s.setSorting,
		grouping: s.grouping,
		setGrouping: s.setGrouping,
		currentScope: s.currentScope,
	}));

	const groupingValue: ReviewGrouping = ["none", "article"].includes(grouping) ? grouping : "date";
	const sortValue: ReviewSortingOrder = sorting === "oldest" ? "oldest" : "newest";

	const handleGroupingChange = useCallback((value: string) => setGrouping(value as ReviewGrouping), [setGrouping]);
	const handleSortChange = useCallback((value: string) => setSorting(value as ReviewSortingOrder), [setSorting]);

	return (
		<Popover modal={false} onOpenChange={setIsOpen} open={isOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<FloatingTriggerButton
							aria-label={t("editor.modes.view")}
							data-state={isOpen ? "open" : "closed"}
						>
							<Icon className="h-3.5 w-3.5" icon="settings-2" />
						</FloatingTriggerButton>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>{t("editor.modes.view")}</TooltipContent>
			</Tooltip>
			<PopoverContent align="start" className="w-44 overflow-hidden p-0" sideOffset={6}>
				<div className="px-3 py-2.5 text-sm font-semibold">{t("editor.modes.view")}</div>
				<Divider />
				<div className="p-2">
					<div className="px-2 pb-1 pt-2 text-xs font-normal text-muted">
						{t("editor.modes.grouping.title")}
					</div>
					<RadioGroup className="gap-0" onValueChange={handleGroupingChange} value={groupingValue}>
						{GROUPING_OPTIONS.map((option) => (
							<div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer" key={option.value}>
								<RadioGroupItem
									disabled={Boolean(option.scope && option.scope !== currentScope)}
									id={`review-grouping-${option.value}`}
									value={option.value}
								/>
								<Label
									className="flex-1 text-sm font-normal cursor-pointer"
									htmlFor={`review-grouping-${option.value}`}
								>
									{t(option.label as keyof typeof t)}
								</Label>
							</div>
						))}
					</RadioGroup>
					<Divider className="my-1" />
					<div className="px-2 pb-1 pt-2 text-xs font-normal text-muted">
						{t("editor.modes.sorting.order")}
					</div>
					<RadioGroup className="gap-0" onValueChange={handleSortChange} value={sortValue}>
						{SORT_OPTIONS.map((option) => (
							<div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer" key={option.value}>
								<RadioGroupItem id={`review-sorting-${option.value}`} value={option.value} />
								<Label
									className="flex-1 text-sm font-normal cursor-pointer"
									htmlFor={`review-sorting-${option.value}`}
								>
									{t(option.label as keyof typeof t)}
								</Label>
							</div>
						))}
					</RadioGroup>
				</div>
			</PopoverContent>
		</Popover>
	);
};
