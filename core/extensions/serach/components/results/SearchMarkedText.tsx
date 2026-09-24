import { SearchResultMatch } from "@ext/serach/components/results/SearchResultMatch";
import type { SearchResultMarkItem } from "@ext/serach/Searcher";

export interface SearchMarkedTextProps {
	marks: SearchResultMarkItem[];
}

export const SearchMarkedText = (props: SearchMarkedTextProps) => {
	const { marks } = props;

	return marks.map((x, i) =>
		// biome-ignore lint/suspicious/noArrayIndexKey: idc
		x.type === "highlight" ? <SearchResultMatch key={i} text={x.text} /> : x.text,
	);
};
