import type Url from "@core-ui/ApiServices/Types/Url";
import useWatch from "@core-ui/hooks/useWatch";
import type { SearchFragmentInfo } from "@ext/serach/utils/ArticleFragmentCounter/ArticleFragmentCounter";
import { createLinkFocusItem, type FocusItem, FocusItemsCollector } from "@ext/serach/utils/FocusItemsCollector";
import type {
	LinkOpenSideEffectOptions,
	RowSearchResult,
	SearchItemRow,
	SearchItemRowId,
} from "@ext/serach/utils/SearchRowsModel";
import { useCallback, useMemo, useState } from "react";
import type { ArticleRow, ArticleRowExpanderItem, ArticleRowItem, ArticleRowParagraphItem, Row } from "../rowTypes";

const DEFAULT_SHOW_PARAGRAPH = 3;
const HIDDEN_EXPAND_COUNT = 5;

export interface SearchLinkTarget {
	/** Where to navigate — carries the highlight query. */
	url: Url;
	pathname: string;
	fragmentInfo?: SearchFragmentInfo;
}

export type OnLinkOpen = (target: SearchLinkTarget) => void;

export const searchLinkTarget = (item: { url: Url; openSideEffect: LinkOpenSideEffectOptions }): SearchLinkTarget => ({
	url: item.url,
	pathname: item.openSideEffect.params.pathname,
	fragmentInfo: item.openSideEffect.params.fragmentInfo,
});

export interface UseSearchResultsArgs {
	rows: RowSearchResult[];
	onLinkOpen: OnLinkOpen;
}

export interface UseSearchResultsResult {
	results: Row[];
	focus: SearchFocus;
}

export interface SearchFocus {
	current: FocusItem | undefined;
	/**
	 * Non-zero while the focus is being driven by the keyboard, so the view knows to scroll it into
	 * view. A fresh value on every request, so re-focusing the item already focused still scrolls.
	 */
	keyboardRequest: number;
	set: (id: SearchItemRowId | undefined) => void;
	move: (delta: number) => void;
	handleKeyDown: (e: { code: string }) => boolean;
}

interface FocusState {
	item: FocusItem | undefined;
	keyboardRequest: number;
}

export const useSearchResults = (args: UseSearchResultsArgs): UseSearchResultsResult => {
	const { rows, onLinkOpen } = args;
	const [showingMap, setShowingMap] = useState(new Map<SearchItemRowId, number>());
	const [focus, setFocus] = useState<FocusState>({ item: undefined, keyboardRequest: 0 });
	const focusItem = focus.item;

	const setFocusItem = useCallback((item: FocusItem | undefined) => {
		setFocus({ item, keyboardRequest: 0 });
	}, []);

	const focusByKeyboard = useCallback((item: FocusItem | undefined) => {
		setFocus((prev) => ({ item, keyboardRequest: prev.keyboardRequest + 1 }));
	}, []);

	useWatch(() => {
		setFocus({ item: undefined, keyboardRequest: 0 });
		setShowingMap(new Map());
	}, [rows]);

	const setShowing = useCallback(
		(id: SearchItemRowId, newValue: number) => {
			const newMap = new Map(showingMap);
			newMap.set(id, newValue);
			setShowingMap(newMap);
		},
		[showingMap],
	);

	const { results, focusableCollector } = useMemo(() => {
		const results: Row[] = [];
		const focusableCollector = new FocusItemsCollector();

		for (const row of rows) {
			const type = row.type;
			switch (type) {
				case "catalog": {
					results.push(row);
					focusableCollector.addLinkItem(row, () => {
						onLinkOpen(searchLinkTarget(row));
					});
					break;
				}
				case "article": {
					focusableCollector.addLinkItem(row, () => {
						onLinkOpen(searchLinkTarget(row));
					});
					const items = getArticleRowItems(
						row.id,
						row.items,
						showingMap,
						focusableCollector,
						setShowing,
						focusByKeyboard,
						onLinkOpen,
					);

					const item: ArticleRow = { ...row, items };

					results.push(item);
					break;
				}
				default:
					throw new Error(`Unexpected search result row type ${type}`);
			}
		}

		return { results, focusableCollector };
	}, [rows, showingMap, onLinkOpen, setShowing, focusByKeyboard]);

	const setFocusId = useCallback(
		(id: SearchItemRowId | undefined) => {
			setFocusItem(id ? focusableCollector.get(id) : undefined);
		},
		[focusableCollector, setFocusItem],
	);

	const moveFocus = useCallback(
		(delta: number) => {
			if (!focusItem) return void focusByKeyboard(focusableCollector.first());

			if (focusItem.type === "temp") {
				focusByKeyboard(focusableCollector.getByIndex(focusItem.index + (delta > 0 ? delta - 1 : delta)));
				return;
			}

			focusByKeyboard(focusableCollector.get(focusItem.id, delta));
		},
		[focusItem, focusableCollector, focusByKeyboard],
	);

	const handleKeyDown = useCallback(
		(e: { code: string }) => {
			if (e.code === "ArrowUp") {
				moveFocus(-1);
				return true;
			}

			if (e.code === "ArrowDown") {
				moveFocus(1);
				return true;
			}

			if (e.code === "Enter" && focusItem) {
				// The stored item keeps the closures of the render it was collected in; the collector
				// has the current ones, which matters for an expander clicked more than once.
				(focusableCollector.get(focusItem.id) ?? focusItem).onClick();
				return true;
			}

			return false;
		},
		[moveFocus, focusItem, focusableCollector],
	);

	return {
		results,
		focus: {
			current: focusItem,
			keyboardRequest: focus.keyboardRequest,
			set: setFocusId,
			move: moveFocus,
			handleKeyDown,
		},
	};
};

function getArticleRowItems(
	parentId: SearchItemRowId,
	items: SearchItemRow[],
	showingMap: Map<SearchItemRowId, number>,
	focusableCollector: FocusItemsCollector,
	setShowing: (id: SearchItemRowId, count: number) => void,
	focusInView: (item: FocusItem) => void,
	onLinkOpen: OnLinkOpen,
): ArticleRowItem[] {
	const addHiddenOrExpander = (
		res: ArticleRowItem[],
		paragraphCountBuffer: number,
		showing: number,
		expanderId: SearchItemRowId | undefined,
		hiddens: ArticleRowParagraphItem[],
	) => {
		if (hiddens.length === 1) {
			const firstHidden = hiddens[0];
			res.push(firstHidden);
			if (firstHidden.focusable)
				focusableCollector.addLinkItem(firstHidden, () => {
					onLinkOpen(searchLinkTarget(firstHidden));
				});

			return true;
		}

		if (!expanderId) return false;
		if (paragraphCountBuffer <= showing) return false;
		const hiddenCount = paragraphCountBuffer - showing;
		const expander: ArticleRowExpanderItem = {
			type: "expander",
			focusable: true,
			id: expanderId,
			count: hiddenCount,
			onClick: () => {
				setShowing(expanderId, showing + HIDDEN_EXPAND_COUNT);

				const keepsHidden = hiddenCount - HIDDEN_EXPAND_COUNT > 1;
				if (keepsHidden) return focusInView(expander);

				const lastRevealed = hiddens[hiddens.length - 1];
				focusInView(
					lastRevealed.focusable
						? createLinkFocusItem(lastRevealed, () => {
								onLinkOpen(searchLinkTarget(lastRevealed));
							})
						: {
								type: "temp",
								id: lastRevealed.id,
								index: focusableCollector.getIndex(expanderId),
								onClick: () => {},
							},
				);
			},
		};

		res.push(expander);
		focusableCollector.addItem(expander);
		return true;
	};

	const handleItemsRecursively = (parentId: SearchItemRowId, items: SearchItemRow[], singleBlockFocus: boolean) => {
		const res: ArticleRowItem[] = [];

		let paragraphCountBuffer = 0;
		let expanderId: SearchItemRowId | undefined;
		let showing = DEFAULT_SHOW_PARAGRAPH;
		let hiddens: ArticleRowParagraphItem[] = [];

		const resetParagraphGroup = () => {
			paragraphCountBuffer = 0;
			expanderId = undefined;
			showing = DEFAULT_SHOW_PARAGRAPH;
			hiddens = [];
		};

		const setParagraphGroupStart = (groupStartId: SearchItemRowId) => {
			expanderId = `${parentId}_expand_${groupStartId}`;
			showing = showingMap.get(expanderId) ?? DEFAULT_SHOW_PARAGRAPH;
		};

		items.forEach((item) => {
			const type = item.type;
			switch (type) {
				case "link": {
					const rowItem: ArticleRowParagraphItem = {
						...item,
						focusable: !singleBlockFocus,
					};
					if (paragraphCountBuffer === 0) setParagraphGroupStart(rowItem.id);
					paragraphCountBuffer++;

					if (paragraphCountBuffer > showing) {
						hiddens.push(rowItem);
						break;
					}

					if (!singleBlockFocus)
						focusableCollector.addLinkItem(item, () => {
							onLinkOpen(searchLinkTarget(item));
						});

					res.push(rowItem);
					break;
				}
				case "block":
				case "file-block": {
					addHiddenOrExpander(res, paragraphCountBuffer, showing, expanderId, hiddens);
					resetParagraphGroup();

					if (!singleBlockFocus)
						focusableCollector.addLinkItem(item, () => {
							onLinkOpen(searchLinkTarget(item));
						});

					const childrenSingleFocus = singleBlockFocus || item.type === "file-block";

					res.push({
						...item,
						focusable: !singleBlockFocus,
						childrenFocusable: !childrenSingleFocus,
						children: handleItemsRecursively(item.id, item.children, childrenSingleFocus),
					});
					break;
				}
				case "diagram": {
					addHiddenOrExpander(res, paragraphCountBuffer, showing, expanderId, hiddens);
					resetParagraphGroup();

					if (!singleBlockFocus)
						focusableCollector.addLinkItem(item, () => {
							onLinkOpen(searchLinkTarget(item));
						});

					res.push({
						...item,
						focusable: !singleBlockFocus,
						childrenFocusable: false,
						children: handleItemsRecursively(item.id, item.children, true),
					});
					break;
				}
				default:
					throw new Error(`Unexpected search result row item type ${type}`);
			}
		});

		addHiddenOrExpander(res, paragraphCountBuffer, showing, expanderId, hiddens);
		return res;
	};

	const res = handleItemsRecursively(parentId, items, false);
	return res;
}
