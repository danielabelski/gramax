import { shouldPropertyVisible } from "@ext/properties/logic/shouldPropertyVisible";
import type { Property } from "@ext/properties/models";
import {
	buildFilterableProperties,
	type FilterablePropertyItem,
	selectAllFilterablePropertyValues,
	selectEmptyFilterablePropertyValue,
	toggleFilterablePropertyValue,
} from "@ext/serach/components/propertyFilter/propertyFilterModel";
import { useCallback, useMemo, useState } from "react";

export interface FilterablePropertyController {
	item: FilterablePropertyItem;
	valuesFilter: {
		value: string;
		set: (value: string) => void;
	};
	toggleValue: (value?: string) => void;
	toggleEmpty: () => void;
	toggleAll: () => void;
	clear: () => void;
}

interface UsePropertyFilterArgs {
	isReadOnlyPlatform: boolean;
	properties: Map<string, Property>;
}

export interface UsePropertyFilterResult {
	controllers: FilterablePropertyController[];
	selected: FilterablePropertyItem[];
	filter: {
		value: string;
		set: (q: string) => void;
	};
	clearFilteredProperties: () => void;
}

export function usePropertyFilter({ properties, isReadOnlyPlatform }: UsePropertyFilterArgs): UsePropertyFilterResult {
	const [filteredProperties, setFilteredProperties] = useState<FilterablePropertyItem[]>([]);
	const [propertyQuery, setPropertyQuery] = useState<string>("");
	const [propertyValuesQueries, setPropertyValuesQueries] = useState<Map<string, string>>(new Map());
	const { availableProperties, availablePropertiesMap } = useMemo(() => {
		const availableProperties = [...properties.values()].filter(
			(x) => filterablePropertyTypes[x.type] === true && shouldPropertyVisible(x, isReadOnlyPlatform),
		);
		const availablePropertiesMap = new Map(availableProperties.map((property) => [property.id, property]));
		return { availableProperties, availablePropertiesMap };
	}, [properties, isReadOnlyPlatform]);

	const { filterableProperties } = useMemo(
		() => buildFilterableProperties(availableProperties, filteredProperties, propertyQuery, propertyValuesQueries),
		[availableProperties, filteredProperties, propertyQuery, propertyValuesQueries],
	);

	const setPropertyValuesQuery = useCallback(
		(name: string, q: string) => {
			const newMap = new Map(propertyValuesQueries);
			newMap.set(name, q.toLowerCase());
			setPropertyValuesQueries(newMap);
		},
		[propertyValuesQueries],
	);

	const clearPropertySelection = useCallback((name: string) => {
		setFilteredProperties((prev) => prev.filter((item) => item.property.id !== name));
	}, []);

	const propertiesControllers = useMemo(
		() =>
			filterableProperties.array.map((item) => ({
				item,
				valuesFilter: {
					value: propertyValuesQueries.get(item.property.id) ?? "",
					set: (q: string) => setPropertyValuesQuery(item.property.id, q),
				},
				toggleValue: (value?: string) =>
					setFilteredProperties((prev) =>
						toggleFilterablePropertyValue(prev, availablePropertiesMap, item.property.id, value),
					),
				toggleEmpty: () =>
					setFilteredProperties((prev) =>
						selectEmptyFilterablePropertyValue(prev, availablePropertiesMap, item.property.id),
					),
				toggleAll: () =>
					setFilteredProperties((prev) =>
						selectAllFilterablePropertyValues(prev, availablePropertiesMap, item.property.id),
					),
				clear: () => clearPropertySelection(item.property.id),
			})),
		[
			filterableProperties.array,
			availablePropertiesMap,
			propertyValuesQueries,
			setPropertyValuesQuery,
			clearPropertySelection,
		],
	);

	const setPropertyFilter = useCallback((q: string) => setPropertyQuery(q.toLowerCase()), []);
	const clearFilteredProperties = useCallback(() => setFilteredProperties([]), []);

	return {
		controllers: propertiesControllers,
		selected: filteredProperties,
		filter: {
			value: propertyQuery,
			set: setPropertyFilter,
		},
		clearFilteredProperties,
	};
}

const filterablePropertyTypes: Partial<Record<Property["type"], boolean>> = {
	Enum: true,
	Flag: true,
	Many: true,
};
