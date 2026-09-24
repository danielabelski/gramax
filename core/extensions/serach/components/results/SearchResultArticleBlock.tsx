import Url from "@core-ui/ApiServices/Types/Url";
import { type OnLinkOpen, searchLinkTarget } from "@ext/serach/components/hooks/useSearchResults";
import { SearchFocusableWrapper } from "@ext/serach/components/results/SearchFocusableWrapper";
import { SearchResultArticleItem } from "@ext/serach/components/results/SearchResultArticleItem";
import { SearchResultDiagramHeaderItem } from "@ext/serach/components/results/SearchResultDiagramHeaderItem";
import { SearchResultExpanderItem } from "@ext/serach/components/results/SearchResultExpanderItem";
import { SearchResultFileHeaderItem } from "@ext/serach/components/results/SearchResultFileHeaderItem";
import { SearchResultHeaderItem } from "@ext/serach/components/results/SearchResultHeaderItem";
import { SearchResultParagraphItem } from "@ext/serach/components/results/SearchResultParagraphItem";
import type { ArticleRow, ArticleRowItem, ArticleRowNestedItem } from "@ext/serach/components/rowTypes";
import type { FocusItem } from "@ext/serach/utils/FocusItemsCollector";
import type { SearchItemRowId } from "@ext/serach/utils/SearchRowsModel";

export interface SearchRowContext {
	onLinkOver: (id: SearchItemRowId) => void;
	onFocus: (id: SearchItemRowId) => void;
	onLinkOpen: OnLinkOpen;
	focusItem: FocusItem | undefined;
	focusRef: React.RefObject<HTMLElement>;
}

export interface SearchResultArticleBlockProps extends SearchRowContext {
	row: ArticleRow;
	isCurrent?: boolean;
	showCatalog: boolean;
}

export const SearchResultArticleBlock = (props: SearchResultArticleBlockProps) => {
	const { row, isCurrent, showCatalog, onFocus, onLinkOpen, onLinkOver, focusItem, focusRef } = props;

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
			>
				<SearchResultArticleItem
					breadcrumbs={row.rawResult.breadcrumbs}
					catalog={{
						name: row.rawResult.catalog.name,
						title: row.rawResult.catalog.title,
						url: row.rawResult.catalog.url,
					}}
					isCurrent={isCurrent}
					isRecommended={row.rawResult.isRecommended}
					onBreadcrumbOpen={(pathname) => onLinkOpen({ url: Url.from({ pathname }), pathname })}
					onOpen={() => onLinkOpen(searchLinkTarget(row))}
					showCatalog={showCatalog}
					title={row.rawResult.title}
					url={row.url}
				/>
			</SearchFocusableWrapper>
			<SearchResultItems ctx={props} items={row.items} />
		</div>
	);
};

interface SearchResultItemsProps {
	items: ArticleRowItem[];
	ctx: SearchRowContext;
}

const SearchResultItems = (props: SearchResultItemsProps) => {
	const { items, ctx } = props;

	return (
		<div className="ml-2.5 border-l-[1px] border-secondary-border pl-1">
			{items.map((x) => (
				<SearchResultItem ctx={ctx} item={x} key={x.id} />
			))}
		</div>
	);
};

interface SearchResultItemProps {
	item: ArticleRowItem;
	ctx: SearchRowContext;
}

const SearchResultItem = (props: SearchResultItemProps) => {
	const { item, ctx } = props;
	if ("children" in item) return <SearchResultNestedItem ctx={ctx} item={item} />;

	return <SearchFocusableWrapper {...wrapperProps(item, ctx)}>{itemContent(item)}</SearchFocusableWrapper>;
};

interface SearchResultNestedItemProps {
	item: ArticleRowNestedItem;
	ctx: SearchRowContext;
}

const SearchResultNestedItem = (props: SearchResultNestedItemProps) => {
	const { item, ctx } = props;
	const insideTarget = !item.childrenFocusable;
	const children = <SearchResultItems ctx={ctx} items={item.children} />;

	return (
		<>
			<SearchFocusableWrapper {...wrapperProps(item, ctx)}>
				{itemContent(item)}
				{insideTarget && children}
			</SearchFocusableWrapper>
			{!insideTarget && children}
		</>
	);
};

const wrapperProps = (item: ArticleRowItem, ctx: SearchRowContext) => ({
	focusItem: ctx.focusItem,
	focusRef: ctx.focusRef,
	item,
	onFocus: ctx.onFocus,
	onLinkOver: ctx.onLinkOver,
	...(item.type === "expander"
		? { onClick: item.onClick }
		: { url: item.url, onClick: () => ctx.onLinkOpen(searchLinkTarget(item)) }),
});

const itemContent = (item: ArticleRowItem) => {
	const type = item.type;
	switch (type) {
		case "link":
			return <SearchResultParagraphItem text={item.marks} />;
		case "block":
			return <SearchResultHeaderItem breadcrumbs={item.breadcrumbs} />;
		case "file-block":
			return <SearchResultFileHeaderItem fileName={item.fileName} title={item.title} />;
		case "diagram":
			return <SearchResultDiagramHeaderItem title={item.title} />;
		case "expander":
			return <SearchResultExpanderItem count={item.count} />;
		default:
			throw new Error(`Unexpected row item type ${type}`);
	}
};
