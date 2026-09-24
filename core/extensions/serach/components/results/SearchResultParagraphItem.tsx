import { SearchMarkedText } from "@ext/serach/components/results/SearchMarkedText";
import { SearchResultRow } from "@ext/serach/components/results/SearchResultRow";
import type { SearchResultMarkItem } from "@ext/serach/Searcher";

export interface SearchResultParagraphItemProps {
	text: SearchResultMarkItem[];
}

export const SearchResultParagraphItem = (props: SearchResultParagraphItemProps) => {
	const { text } = props;

	return (
		<SearchResultRow>
			<SearchMarkedText marks={text} />
		</SearchResultRow>
	);
};
