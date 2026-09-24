import t from "@ext/localization/locale/translate";
import { SearchMarkedText } from "@ext/serach/components/results/SearchMarkedText";
import { SearchResultBadge } from "@ext/serach/components/results/SearchResultBadge";
import { SearchResultRow } from "@ext/serach/components/results/SearchResultRow";
import type { SearchResultMarkItem } from "@ext/serach/Searcher";

export interface SearchResultDiagramHeaderItemProps {
	title: SearchResultMarkItem[];
}

export const SearchResultDiagramHeaderItem = (props: SearchResultDiagramHeaderItemProps) => {
	const { title } = props;

	return (
		<>
			<SearchResultRow tone="badge">
				<SearchResultBadge icon="diagrams" text={t("diagram.name")} />
			</SearchResultRow>
			{title.length > 0 && (
				<SearchResultRow tone="emphasis">
					<SearchMarkedText marks={title} />
				</SearchResultRow>
			)}
		</>
	);
};
