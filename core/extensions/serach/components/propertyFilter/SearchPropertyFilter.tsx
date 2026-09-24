import t from "@ext/localization/locale/translate";
import PropertiesScrollContainer from "@ext/properties/components/Helpers/PropertiesScrollContainer";
import type { Property } from "@ext/properties/models";
import { SearchPropertyValuesDropdownContent } from "@ext/serach/components/propertyFilter/SearchPropertyValuesDropdownContent";
import type { FilterablePropertyController } from "@ext/serach/components/propertyFilter/usePropertyFilter";
import { WithTooltip } from "@ext/serach/components/WithTooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTriggerButton,
	useFrozenDropdownPosition,
} from "@ui-kit/Dropdown";
import { MenuItemIcon } from "@ui-kit/MenuItem";
import { useState } from "react";

export type SearchPropertyFilterProps = {
	controllers: FilterablePropertyController[];
	hasSelection: boolean;
	onResetAll: () => void;
};

export const SearchPropertyFilter = (props: SearchPropertyFilterProps) => {
	const { controllers, hasSelection, onResetAll } = props;
	const [open, setOpen] = useState(false);
	const triggerRef = useFrozenDropdownPosition<HTMLButtonElement>(open);
	if (!controllers.length) return;

	return (
		<DropdownMenu onOpenChange={setOpen} open={open}>
			<WithTooltip tooltip={t("search.property-filter.tooltip")}>
				<span className="rounded-full">
					<DropdownMenuTriggerButton
						className="size-7 flex items-center justify-center p-0.5 rounded-full"
						ref={triggerRef}
						startIcon={"list-filter-plus"}
						variant="ghost"
					/>
				</span>
			</WithTooltip>
			<DropdownMenuContent align="start" className="font-sans">
				<PropertiesScrollContainer>
					{controllers.map((controller) => (
						<PropertyWithSubmenu controller={controller} key={controller.item.property.id} />
					))}
				</PropertiesScrollContainer>
				{hasSelection && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={onResetAll}>
							<div className="flex items-center gap-2 w-full">
								<div className="w-4 h-4 shrink-0">
									<MenuItemIcon icon="circle-x" />
								</div>
								{t("search.property-filter.reset-all")}
							</div>
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

interface PropertyWithSubmenuProps {
	controller: FilterablePropertyController;
}

const PropertyWithSubmenu = (props: PropertyWithSubmenuProps) => {
	const { controller } = props;
	const { property } = controller.item;

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<PropertyFilterItemLabel property={property} />
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent>
				<SearchPropertyValuesDropdownContent controller={controller} />
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
};

const PropertyFilterItemLabel = ({ property }: { property: Property }) => (
	<div className="flex items-center gap-2 w-full">
		<div className="w-4 h-4 shrink-0">{property.icon && <MenuItemIcon icon={property.icon} />}</div>
		{property.name}
	</div>
);
