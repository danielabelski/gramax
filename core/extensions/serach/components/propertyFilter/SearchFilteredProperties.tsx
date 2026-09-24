import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { getPropertyValueLabel } from "@ext/serach/components/propertyFilter/propertyFilterModel";
import { SearchPropertyValuesDropdownContent } from "@ext/serach/components/propertyFilter/SearchPropertyValuesDropdownContent";
import type { FilterablePropertyController } from "@ext/serach/components/propertyFilter/usePropertyFilter";
import { WithTooltip } from "@ext/serach/components/WithTooltip";
import { Counter } from "@ui-kit/Counter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { TagButton, TagClose, TagWrapper } from "@ui-kit/Tag";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";

const TOOLTIP_MAX_VALUES = 7;

export type SearchFilteredPropertiesProps = {
	controllers: FilterablePropertyController[];
};

export const SearchFilteredProperties = (props: SearchFilteredPropertiesProps) => {
	const { controllers } = props;

	return controllers.map((controller) => <PropertyBadge controller={controller} key={controller.item.property.id} />);
};

interface PropertyBadgeProps {
	controller: FilterablePropertyController;
}

const PropertyBadge = (props: PropertyBadgeProps) => {
	const { controller } = props;
	const insideBadgeRef = useRef(false);
	const [dropdownOpened, setDropdownOpened] = useState(false);

	const emptySelected = controller.item.selection.emptySelected;
	const values = controller.item.selection.options
		.filter((x) => x.selected)
		.map((x) => getPropertyValueLabel(controller.item.property.type, x.value));
	const displayValues = emptySelected ? [t("properties.empty")].concat(values) : values;

	const valueNode =
		displayValues.length > 1 ? (
			<>
				{t("search.property-filter.selected")}{" "}
				<Counter className="rounded-full bg-alpha-high-90 text-muted" size="md" variant="secondary">
					{displayValues.length}
				</Counter>
			</>
		) : displayValues.length === 1 ? (
			displayValues[0]
		) : null;

	const shouldRender = valueNode !== null || dropdownOpened;

	if (!shouldRender) return null;

	return (
		<DropdownMenu onOpenChange={(open) => setDropdownOpened(open)} open={dropdownOpened}>
			<div
				onMouseDown={(e) => {
					if (e.button !== 1) return;
					insideBadgeRef.current = true;
					e.preventDefault();
				}}
				onMouseLeave={() => {
					insideBadgeRef.current = false;
				}}
				onMouseUp={(e) => {
					if (e.button === 1 && insideBadgeRef.current) {
						controller.clear();
						e.preventDefault();
					}

					insideBadgeRef.current = false;
				}}
			>
				<PropertyBadgeTrigger controller={controller} selectedValues={displayValues}>
					{valueNode !== null ? (
						<>
							{controller.item.property.name}: {valueNode}
						</>
					) : (
						controller.item.property.name
					)}
				</PropertyBadgeTrigger>
			</div>
			<DropdownMenuContent align="start">
				<SearchPropertyValuesDropdownContent controller={controller} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

interface PropertyBadgeTriggerProps {
	controller: FilterablePropertyController;
	selectedValues: string[];
	children: ReactNode;
}

const PropertyBadgeTrigger = (props: PropertyBadgeTriggerProps) => {
	const { children, controller, selectedValues } = props;
	const tooltipContent =
		selectedValues.length > TOOLTIP_MAX_VALUES
			? `${selectedValues.slice(0, TOOLTIP_MAX_VALUES).join(", ")}, +${selectedValues.length - TOOLTIP_MAX_VALUES}`
			: selectedValues.join(", ");
	const style = controller.item.property.style;
	const propertyStyleVars = {
		"--property-bg-color": `var(--color-property-bg-${style})`,
		"--property-border-color": `var(--color-property-border-${style})`,
		"--property-text-color": `var(--color-property-text-${style})`,
	};
	const propertyStyleClasses = cn(
		style &&
			"hover:bg-[var(--property-bg-color)] hover:brightness-[var(--filter-property)] bg-[var(--property-bg-color)] border-[var(--property-border-color)] text-[var(--property-text-color)]",
	);
	return (
		<TagWrapper className="h-7" size="md" style={propertyStyleVars as unknown as CSSProperties}>
			<WithTooltip tooltip={tooltipContent}>
				<span className="rounded-l-lg">
					<DropdownMenuTrigger asChild>
						<span className="group rounded-l-lg data-[state=open]:bg-status-neutral-bg-hover">
							<TagButton
								className={cn(
									"rounded-l-lg h-7 py-1.5 px-2 font-normal border-r",
									"group-data-[state=open]:bg-status-neutral-bg-hover",
									style &&
										"group-data-[state=open]:bg-[--property-bg-color] group-data-[state=open]:brightness-[--filter-property]",
									propertyStyleClasses,
								)}
								position="left"
								size="md"
							>
								{children}
							</TagButton>
						</span>
					</DropdownMenuTrigger>
				</span>
			</WithTooltip>
			<TagClose
				className={cn("rounded-r-lg h-7 py-1.5 px-2.5 font-normal focus-visible:z-10", propertyStyleClasses)}
				onClick={() => controller.clear()}
				size="md"
			/>
		</TagWrapper>
	);
};
