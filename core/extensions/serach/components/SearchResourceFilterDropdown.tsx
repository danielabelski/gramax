import t from "@ext/localization/locale/translate";
import { SearchFilterDropdown } from "@ext/serach/components/SearchFilterDropdown";
import type { ResourceFilter } from "@ext/serach/Searcher";

export type SearchResourceFilterDropdownProps = {
	value: ResourceFilter;
	setValue: (resourceFilter: ResourceFilter) => void;
};

export const SearchResourceFilterDropdown = (props: SearchResourceFilterDropdownProps) => {
	const { value: resourceFilter, setValue } = props;
	const resourceFilterLabel = {
		without: t("search.resource-filter.without-resources"),
		with: t("search.resource-filter.with-resources"),
		only: t("search.resource-filter.only-resources"),
	};

	return (
		<SearchFilterDropdown
			labels={resourceFilterLabel}
			onSelect={(v) => setValue(v)}
			tooltip={t("search.resource-filter.tooltip")}
			value={resourceFilter}
			values={["without", "with", "only"]}
		/>
	);
};
