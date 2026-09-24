import type { ExpanderFocusItem } from "../utils/FocusItemsCollector";
import type {
	RowArticleSearchResult,
	RowCatalogSearchResult,
	SearchItemDiagramRow,
	SearchItemFileBlockRow,
	SearchItemHeaderBlockRow,
	SearchItemLinkRow,
} from "../utils/SearchRowsModel";

export type Row = CatalogRow | ArticleRow;

export interface CatalogRow extends RowCatalogSearchResult {}

export interface ArticleRow extends Omit<RowArticleSearchResult, "items"> {
	items: ArticleRowItem[];
}

export interface ArticleRowItemBase {
	focusable: boolean;
}

export interface ArticleRowBlockItemBase extends ArticleRowItemBase {
	children: ArticleRowItem[];
	childrenFocusable: boolean;
}

export interface ArticleRowHeaderBlockItem
	extends Omit<SearchItemHeaderBlockRow, "children">,
		ArticleRowBlockItemBase {}

export interface ArticleRowFileBlockItem extends Omit<SearchItemFileBlockRow, "children">, ArticleRowBlockItemBase {}

export type ArticleRowBlockItem = ArticleRowHeaderBlockItem | ArticleRowFileBlockItem;

export interface ArticleRowParagraphItem extends SearchItemLinkRow, ArticleRowItemBase {}

export interface ArticleRowDiagramItem extends Omit<SearchItemDiagramRow, "children">, ArticleRowBlockItemBase {}

export interface ArticleRowExpanderItem extends ExpanderFocusItem, ArticleRowItemBase {}

export type ArticleRowNestedItem = ArticleRowBlockItem | ArticleRowDiagramItem;

export type ArticleRowItem = ArticleRowNestedItem | ArticleRowParagraphItem | ArticleRowExpanderItem;
