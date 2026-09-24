import { WithTooltip } from "@ext/serach/components/WithTooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTriggerButton,
} from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";

export interface SearchFilterDropdownProps<T extends string> {
	value: T;
	values: T[];
	labels: Record<T, string>;
	onSelect: (value: T) => void;
	tooltip?: string;
}

export const SearchFilterDropdown = <T extends string>(props: SearchFilterDropdownProps<T>) => {
	const { value, values, labels, onSelect, tooltip } = props;

	return (
		<DropdownMenu>
			<WithTooltip tooltip={tooltip}>
				<DropdownMenuTriggerButton className="rounded-lg h-7 py-1.5 px-2.5 font-normal -shadow-soft-sm pr-2">
					{labels[value]}
					<Icon className="text-primary-fg" icon="chevron-down" />
				</DropdownMenuTriggerButton>
			</WithTooltip>
			<DropdownMenuContent align="start" className="font-sans">
				<DropdownMenuRadioGroup
					indicatorIconPosition="start"
					onValueChange={(v) => onSelect(v as T)}
					value={value}
				>
					{values.map((value) => (
						<DropdownMenuRadioItem key={value} value={value}>
							{labels[value]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
