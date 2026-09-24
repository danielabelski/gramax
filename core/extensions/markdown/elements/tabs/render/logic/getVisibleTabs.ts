import type { CatalogView } from "@ext/catalog/views/models/CatalogViews";
import type TabAttrs from "@ext/markdown/elements/tabs/model/TabAttrs";
import type { PropertyValue } from "@ext/properties/models";

const isVisible = (tabProperties: PropertyValue[], view: CatalogView): boolean => {
	if (!view.filters?.length) return true;
	const hasNoneFilter = view.filters.some((filter) => filter.value?.includes("none"));
	if (!tabProperties?.length) return !hasNoneFilter;

	return !view.filters.some((filter) => {
		const tabProperty = tabProperties.find((property) => property.id === filter.id);
		if (tabProperty?.value?.every((value) => filter.value?.includes(value))) return true;
		if (filter.value?.includes("yes")) return !!tabProperty;
		if (filter.value?.includes("none")) return !tabProperty;
		return false;
	});
};

const getVisibleTabs = (tabs: TabAttrs[], view?: CatalogView): { tabs: TabAttrs[]; indexes: number[] } => {
	const indexes = tabs.map((_, index) => index);
	if (!view || !tabs.some((tab) => tab.property?.length)) return { tabs, indexes };

	const visibleIndexes = indexes.filter((index) => isVisible(tabs[index].property, view));
	return {
		indexes: visibleIndexes,
		tabs: visibleIndexes.map((index, idx) => ({ ...tabs[index], idx })),
	};
};

export default getVisibleTabs;
