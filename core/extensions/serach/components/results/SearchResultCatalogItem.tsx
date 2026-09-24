import { useGetCatalogLogoSrc } from "@core-ui/ContextServices/CatalogLogoService/catalogLogoHooks";
import { CatalogLogoMark } from "@ext/serach/components/CatalogLogoMark";
import { type OnLinkOpen, searchLinkTarget } from "@ext/serach/components/hooks/useSearchResults";
import { SearchFocusableWrapper } from "@ext/serach/components/results/SearchFocusableWrapper";
import { SearchMarkedText } from "@ext/serach/components/results/SearchMarkedText";
import type { CatalogRow } from "@ext/serach/components/rowTypes";
import type { FocusItem } from "@ext/serach/utils/FocusItemsCollector";
import type { SearchItemRowId } from "@ext/serach/utils/SearchRowsModel";

export interface SearchResultCatalogItemProps {
	row: CatalogRow;
	onLinkOver: (id: SearchItemRowId) => void;
	onFocus: (id: SearchItemRowId) => void;
	onLinkOpen: OnLinkOpen;
	focusItem: FocusItem | undefined;
	focusRef: React.RefObject<HTMLElement>;
}

export const SearchResultCatalogItem = (props: SearchResultCatalogItemProps) => {
	const { row, onFocus, onLinkOpen, onLinkOver, focusItem, focusRef } = props;
	const { logo } = useGetCatalogLogoSrc(row.rawResult.name);

	return (
		<div>
			<SearchFocusableWrapper
				focusItem={focusItem}
				focusRef={focusRef}
				item={{
					id: row.id,
					focusable: true,
				}}
				onClick={() => onLinkOpen(searchLinkTarget(row))}
				onFocus={onFocus}
				onLinkOver={onLinkOver}
				url={row.url}
			>
				<div className="py-2 px-2.5 min-w-0 overflow-hidden flex items-center gap-1">
					<CatalogLogoMark className="size-5" logo={logo} name={row.rawResult.name} />
					<span className="font-medium">
						<SearchMarkedText marks={row.rawResult.title} />
					</span>
				</div>
			</SearchFocusableWrapper>
		</div>
	);
};
