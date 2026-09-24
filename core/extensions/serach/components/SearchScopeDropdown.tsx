import t from "@ext/localization/locale/translate";
import type { SearchScope, SearchScopeMode } from "@ext/serach/components/model/searchScope";
import { SearchFilterDropdown } from "@ext/serach/components/SearchFilterDropdown";

export type SearchScopeDropdownProps<M extends SearchScopeMode> = {
	scopes: SearchScope<M>[];
	isCategory: boolean;
	value: SearchScope<M>;
	setValue: (value: SearchScope<M>) => void;
};

export const SearchScopeDropdown = <M extends SearchScopeMode>(props: SearchScopeDropdownProps<M>) => {
	const { scopes, isCategory, value: scopeFilter, setValue } = props;

	const scopeFilterLabel = {
		all: t("search.scope-filter.all"),
		catalog: t("search.scope-filter.catalog"),
		article: isCategory ? t("search.scope-filter.category") : t("search.scope-filter.article"),
		folder: t("search.scope-filter.folder"),
	};

	return (
		<SearchFilterDropdown
			labels={scopeFilterLabel}
			onSelect={(v) => setValue(v)}
			tooltip={t("search.scope-filter.tooltip")}
			value={scopeFilter}
			values={scopes}
		/>
	);
};
