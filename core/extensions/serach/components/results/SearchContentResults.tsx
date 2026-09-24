import { useScrollAnimation } from "@ext/serach/components/hooks/useScrollAnimation";
import type { OnLinkOpen, SearchFocus } from "@ext/serach/components/hooks/useSearchResults";
import { SearchResultArticleBlock } from "@ext/serach/components/results/SearchResultArticleBlock";
import { SearchResultCatalogItem } from "@ext/serach/components/results/SearchResultCatalogItem";
import type { Row } from "@ext/serach/components/rowTypes";
import { scrollToElement } from "@ext/serach/components/utils/scrollToElement";
import { type RefObject, useEffect, useRef } from "react";

export interface SearchContentResultsProps {
	rows: Row[];
	showCatalog: boolean;
	focus: SearchFocus;
	containerRef: RefObject<HTMLElement>;
	currentRefPath?: string;
	onLinkOpen: OnLinkOpen;
}

export const SearchContentResults = (props: SearchContentResultsProps) => {
	const { rows, showCatalog, containerRef, currentRefPath, onLinkOpen, focus } = props;

	const focusRef = useRef<HTMLElement>(null);
	const scroll = useScrollAnimation();
	// A stationary pointer must not steal focus while the list scrolls underneath it.
	const pointerMovedRef = useRef(true);

	useEffect(() => {
		const onPointerMove = () => {
			pointerMovedRef.current = true;
		};

		document.addEventListener("mousemove", onPointerMove, false);
		return () => document.removeEventListener("mousemove", onPointerMove, false);
	}, []);

	useEffect(() => {
		if (!focus.current || !focus.keyboardRequest) return;

		pointerMovedRef.current = false;
		if (focusRef.current && containerRef.current) scrollToElement(containerRef.current, focusRef.current, scroll);
	}, [focus.current, focus.keyboardRequest, containerRef, scroll]);

	const commonProps = {
		focusItem: focus.current,
		focusRef,
		onFocus: (id: string) => {
			if (!pointerMovedRef.current) focus.set(id);
		},
		onLinkOpen,
		onLinkOver: (id: string) => {
			if (pointerMovedRef.current) focus.set(id);
		},
	};

	return (
		<div>
			{rows.map((row) =>
				row.type === "article" ? (
					<SearchResultArticleBlock
						isCurrent={row.rawResult.refPath === currentRefPath}
						key={row.id}
						row={row}
						showCatalog={showCatalog}
						{...commonProps}
					/>
				) : (
					<SearchResultCatalogItem key={row.id} row={row} {...commonProps} />
				),
			)}
		</div>
	);
};
