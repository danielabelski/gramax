import { SearchMarkedText } from "@ext/serach/components/results/SearchMarkedText";
import { SearchResultBadge } from "@ext/serach/components/results/SearchResultBadge";
import { SearchResultRow } from "@ext/serach/components/results/SearchResultRow";
import type { SearchResultMarkItem } from "@ext/serach/Searcher";

export interface SearchResultFileHeaderItemProps {
	title: SearchResultMarkItem[];
	fileName?: SearchResultMarkItem[];
}

export const SearchResultFileHeaderItem = (props: SearchResultFileHeaderItemProps) => {
	const { title, fileName } = props;

	return (
		<SearchResultRow className="flex items-center gap-2.5" tone="plain">
			<SearchResultBadge
				icon="paperclip"
				text={
					<span>
						<SearchMarkedText marks={fileName ?? title} />
					</span>
				}
			/>
			{fileName && (
				<span>
					{/* TODO: text around attachment */}
					<SearchMarkedText marks={title} />
				</span>
			)}
		</SearchResultRow>
	);
};
