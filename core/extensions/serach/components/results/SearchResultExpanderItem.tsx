import t from "@ext/localization/locale/translate";
import { SearchResultRow } from "@ext/serach/components/results/SearchResultRow";

export interface SearchResultExpanderItemProps {
	count: number;
}

export const SearchResultExpanderItem = (props: SearchResultExpanderItemProps) => {
	const { count } = props;

	return <SearchResultRow>{t("search.hidden-results").replace("{{count}}", String(count))}</SearchResultRow>;
};
