import { ItemType } from "@core/FileStructue/Item/ItemType";
import getArticleItemLink from "@ext/article/LinkCreator/logic/getArticleItemLink";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import {
	getScopesByMode,
	initialScopeByMode,
	nextSearchScope,
	type SearchScope,
	type SearchScopeMode,
} from "@ext/serach/components/model/searchScope";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface UseSearchScopeArgs {
	mode: SearchScopeMode;
	isStatic: boolean;
	itemLinks?: ItemLink[];
	currentArticleRefPath?: string;
}

export interface UseSearchScopeResult {
	value: SearchScope;
	available: SearchScope[];
	set: (scope: SearchScope) => void;
	cycle: () => void;
	isCategory: boolean;
	showCatalogBreadcrumb: boolean;
}

export const useSearchScope = (args: UseSearchScopeArgs): UseSearchScopeResult => {
	const { mode, isStatic, itemLinks, currentArticleRefPath } = args;
	const [value, setValue] = useState<SearchScope>(initialScopeByMode[mode]);
	const available = useMemo(() => getScopesByMode(mode, isStatic), [mode, isStatic]);

	useEffect(() => {
		setValue(initialScopeByMode[mode]);
	}, [mode]);

	const cycle = useCallback(() => setValue((current) => nextSearchScope(mode, current, isStatic)), [mode, isStatic]);

	const isCategory =
		(itemLinks ? getArticleItemLink(itemLinks, currentArticleRefPath) : undefined)?.type === ItemType.category;

	return {
		value,
		available,
		set: setValue,
		cycle,
		isCategory,
		showCatalogBreadcrumb: value === "all" || value === "folder",
	};
};
