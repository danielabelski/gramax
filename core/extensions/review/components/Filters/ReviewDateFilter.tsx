import useWatch from "@core-ui/hooks/useWatch";
import { cn } from "@core-ui/utils/cn";
import type { DatePreset } from "@core-ui/utils/dateUtils";
import DateUtils from "@core-ui/utils/dateUtils";
import t from "@ext/localization/locale/translate";
import { Calendar } from "@ui-kit/Calendar";
import { Icon } from "@ui-kit/Icon";
import { Label } from "@ui-kit/Label";
import { Popover, PopoverContent, PopoverTriggerButton } from "@ui-kit/Popover";
import { ToggleGroup, ToggleGroupItem } from "@ui-kit/ToggleGroup";
import { useCallback, useState } from "react";
import type { DateRange } from "react-day-picker";

interface ReviewDateFilterProps {
	value: DateRange;
	onChange: (value: DateRange) => void;
}

export const ReviewDateFilter = ({ value, onChange }: ReviewDateFilterProps) => {
	const [localValue, setLocalValue] = useState<DateRange>(value);
	const activePreset = DateUtils.detectPreset(localValue);

	useWatch(() => {
		setLocalValue(value);
	}, [value]);

	const handlePreset = useCallback(
		(preset: DatePreset) => {
			const range = DateUtils.getDatePresetRange(preset);
			setLocalValue(range);
			onChange(range);
		},
		[onChange],
	);

	const handleCalendarSelect = useCallback(
		(date: DateRange) => {
			const normalized: DateRange = {
				from: date?.from ? new Date(date.from.setHours(0, 0, 0, 0)) : null,
				to: date?.to ? new Date(date.to.setHours(23, 59, 59, 999)) : null,
			};
			setLocalValue(normalized);
			if (normalized.from && normalized.to) onChange(normalized);
		},
		[onChange],
	);

	const formatDate = (date: Date) =>
		date?.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" }) ?? "";
	const presets = DateUtils.getDatePresets().filter((preset) => preset !== "all-time");

	return (
		<div className="space-y-1.5">
			<div>
				<Label className="text-xs text-muted ml-2">{t("editor.modes.filters.date.title")}</Label>
				<ToggleGroup
					className="justify-start gap-1"
					onValueChange={handlePreset}
					type="single"
					value={activePreset}
					variant="ghost"
				>
					{presets.map((preset) => (
						<ToggleGroupItem
							className="h-7 whitespace-nowrap rounded-full border border-primary-border bg-secondary-bg px-2.5 text-sm font-normal text-primary-fg hover:bg-status-neutral-bg-hover data-[state=on]:border-transparent data-[state=on]:bg-status-neutral data-[state=on]:text-primary-bg data-[state=on]:hover:bg-status-neutral-hover"
							key={preset}
							size="sm"
							value={preset}
						>
							{t(`editor.modes.filters.date.presets.${preset}`)}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</div>
			<Popover>
				<PopoverTriggerButton
					className={cn(
						"w-full justify-start h-auto font-normal !shadow-none hover:!shadow-none active:!shadow-none focus:!shadow-none focus-visible:!shadow-none",
						"invalid:!shadow-none invalid:hover:!shadow-none invalid:focus:!shadow-none",
						"aria-[invalid=true]:!shadow-none aria-[invalid=true]:hover:!shadow-none aria-[invalid=true]:focus:!shadow-none",
						"read-only:!shadow-none disabled:!shadow-none",
					)}
					containerClassName="w-full"
					size="sm"
				>
					<span className="flex-1 text-left text-sm text-muted">
						{localValue?.from && localValue?.to
							? `${formatDate(localValue.from)} — ${formatDate(localValue.to)}`
							: t("editor.modes.filters.date.range-placeholder")}
					</span>
					<Icon className="shrink-0 text-muted" icon="calendar" />
				</PopoverTriggerButton>
				<PopoverContent className="p-0">
					<Calendar
						className="border-0 bg-transparent shadow-none"
						defaultMonth={localValue?.from ?? new Date()}
						mode="range"
						onSelect={handleCalendarSelect}
						selected={localValue}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
};
