import t from "@ext/localization/locale/translate";
import PropertiesScrollContainer from "@ext/properties/components/Helpers/PropertiesScrollContainer";
import { getPropertyValueLabel } from "@ext/serach/components/propertyFilter/propertyFilterModel";
import type { FilterablePropertyController } from "@ext/serach/components/propertyFilter/usePropertyFilter";
import { DropdownMenuCheckboxItem } from "@ui-kit/Dropdown";

export interface SearchPropertyValuesDropdownContentProps {
	controller: FilterablePropertyController;
}

export const SearchPropertyValuesDropdownContent = (props: SearchPropertyValuesDropdownContentProps) => {
	const { controller } = props;
	const { property, selection } = controller.item;
	return (
		<PropertiesScrollContainer>
			<DropdownMenuCheckboxItem
				checked={selection.allSelected}
				onSelect={(e) => {
					e.preventDefault();
					controller.toggleAll();
				}}
			>
				{t("properties.select-all")}
			</DropdownMenuCheckboxItem>
			<DropdownMenuCheckboxItem
				checked={selection.emptySelected}
				onSelect={(e) => {
					e.preventDefault();
					controller.toggleEmpty();
				}}
			>
				{t("properties.empty")}
			</DropdownMenuCheckboxItem>
			{selection.options.map((option) => {
				return (
					<DropdownMenuCheckboxItem
						checked={option.selected}
						key={option.value}
						onSelect={(e) => {
							e.preventDefault();
							controller.toggleValue(option.value);
						}}
					>
						{getPropertyValueLabel(property.type, option.value)}
					</DropdownMenuCheckboxItem>
				);
			})}
		</PropertiesScrollContainer>
	);
};
