import {
	highlightFragmentInDocportal,
	highlightFragmentInEditor,
} from "@components/Article/SearchHandler/ArticleSearchFragmentHander";
import { useRouter } from "@core/Api/useRouter";
import type { Section } from "@core/SitePresenter/SitePresenter";
import type Url from "@core-ui/ApiServices/Types/Url";
import ApiUrlCreator from "@core-ui/ContextServices/ApiUrlCreator";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import ErrorConfirmService from "@ext/errorHandlers/client/ErrorConfirmService";
import type DefaultError from "@ext/errorHandlers/logic/DefaultError";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import PropertyServiceProvider from "@ext/properties/components/PropertyService";
import { useSearchAi } from "@ext/serach/components/hooks/useSearchAi";
import { useSearchAnalytics } from "@ext/serach/components/hooks/useSearchAnalytics";
import { useSearchDialog } from "@ext/serach/components/hooks/useSearchDialog";
import { useSearchHotkeys } from "@ext/serach/components/hooks/useSearchHotkeys";
import { useSearchIndexing } from "@ext/serach/components/hooks/useSearchIndexing";
import { useSearchLinkOpen } from "@ext/serach/components/hooks/useSearchLinkOpen";
import { useSearchQuery } from "@ext/serach/components/hooks/useSearchQuery";
import { useSearchRequest } from "@ext/serach/components/hooks/useSearchRequest";
import { type OnLinkOpen, type SearchFocus, useSearchResults } from "@ext/serach/components/hooks/useSearchResults";
import { useSearchScope } from "@ext/serach/components/hooks/useSearchScope";
import { createSearchGateway } from "@ext/serach/components/model/searchGateway";
import { buildSearchParams } from "@ext/serach/components/model/searchParams";
import { getSearchStatus, type SearchData, type SearchStatus } from "@ext/serach/components/model/searchResponse";
import { getSearchMode, type SearchScope, type SearchScopeMode } from "@ext/serach/components/model/searchScope";
import {
	type UsePropertyFilterResult,
	usePropertyFilter,
} from "@ext/serach/components/propertyFilter/usePropertyFilter";
import type { Row } from "@ext/serach/components/rowTypes";
import SearchQuery from "@ext/serach/components/SearchQueryContext";
import type { ResourceFilter } from "@ext/serach/Searcher";
import type { RowSearchResult } from "@ext/serach/utils/SearchRowsModel";
import { useCallback, useMemo } from "react";

const DEBOUNCE_DELAY = 400;
const CHAT_DEBOUNCE_DELAY = DEBOUNCE_DELAY * 2;
const NO_ROWS: RowSearchResult[] = [];

export type SearchState = SearchNormalState | SearchAiState;

interface SearchStateBase {
	ai: {
		available: boolean;
		toggle(): void;
	};
	query: {
		value: string;
		set(newValue: string): void;
	};
	indexing: {
		inProgress: boolean;
		progress: number;
	};
	dialog: {
		open: boolean;
		setOpen: (open: boolean) => void;
	};
	status: SearchStatus;
	currentArticleRefPath?: string;
	clear: () => void;
	scope: {
		mode: SearchScopeMode;
		value: SearchScope;
		available: SearchScope[];
		set: (scope: SearchScope) => void;
		isCategory: boolean;
		showCatalogBreadcrumb: boolean;
	};
	onLinkOpen: OnLinkOpen;
}

export interface SearchNormalState extends SearchStateBase {
	aiEnabled: false;
	property: UsePropertyFilterResult | undefined;
	data: Row[];
	resourceFilter: {
		value: ResourceFilter;
		set: (resourceFilter: ResourceFilter) => void;
	};
	focus: SearchFocus;
}

export interface SearchAiState extends SearchStateBase {
	aiEnabled: true;
	data: Extract<SearchData, { kind: "chat" }>["nodes"] | null;
}

export interface UseSearchStateArgs {
	isHomePage: boolean;
	itemLinks?: ItemLink[];
	section?: Section;
}

export const useSearchState = (args: UseSearchStateArgs): SearchState => {
	const { isHomePage, itemLinks, section } = args;

	const {
		query,
		setQuery,
		resourceFilter,
		setResourceFilter,
		hasOpenRequest,
		requestedScopeFilter,
		clearOpenRequest,
	} = SearchQuery.value;
	const apiUrlCreator = ApiUrlCreator.value;
	const { properties: catalogProperties } = PropertyServiceProvider.value;
	const { catalogName, catalogDefaultLanguage } = useCatalogPropsStore(
		(state) => ({ catalogName: state.data?.name, catalogDefaultLanguage: state.data?.language }),
		"shallow",
	);
	const { currentPathname, currentArticleRefPath } = useArticlePropsStore(
		(state) => ({ currentPathname: state?.data?.pathname, currentArticleRefPath: state?.data?.ref.path }),
		"shallow",
	);
	const pageDataContext = PageDataContextService.value;
	const currentArticleLanguage = pageDataContext?.language?.content;
	const isReadOnly = pageDataContext?.conf?.isReadOnly;
	const aiConfigured = pageDataContext?.conf?.ai?.enabled ?? false;
	const resourcesEnabled = pageDataContext?.conf?.search?.resourcesEnabled ?? false;
	const { isNext, isStatic, isWeb, isTauri } = usePlatform();
	const router = useRouter();

	const mode = getSearchMode(section, isHomePage);
	// biome-ignore lint/correctness/useExhaustiveDependencies: it's ok
	const gateway = useMemo(() => createSearchGateway(apiUrlCreator), [apiUrlCreator]);
	const onError = useCallback((error: unknown) => ErrorConfirmService.notify(error as DefaultError), []);

	const ai = useSearchAi({
		configured: (isNext || isStatic) && aiConfigured,
		probe: isStatic,
		checkAvailable: gateway.chatAvailable,
	});

	const scope = useSearchScope({ mode, isStatic, itemLinks, currentArticleRefPath });

	const property = usePropertyFilter({
		properties: catalogProperties,
		isReadOnlyPlatform: isReadOnly,
	});

	const sectionCatalogNames = useMemo(() => section?.catalogLinks.map((link) => link.name), [section]);

	const params = useMemo(
		() =>
			buildSearchParams({
				mode,
				scope: scope.value,
				aiEnabled: ai.enabled,
				catalogName,
				catalogDefaultLanguage,
				currentArticleLanguage,
				currentArticleRefPath,
				sectionCatalogNames,
				resourceFilter,
				resourcesEnabled,
				selectedProperties: property.selected,
			}),
		[
			mode,
			scope.value,
			ai.enabled,
			catalogName,
			catalogDefaultLanguage,
			currentArticleLanguage,
			resourcesEnabled,
			currentArticleRefPath,
			sectionCatalogNames,
			resourceFilter,
			property.selected,
		],
	);

	const searchQuery = useSearchQuery({
		query,
		delayMs: ai.enabled ? CHAT_DEBOUNCE_DELAY : DEBOUNCE_DELAY,
		flushOn: params,
	});

	const dialog = useSearchDialog({
		openRequest: { has: hasOpenRequest, scope: requestedScopeFilter, clear: clearOpenRequest },
		canApplyRequestedScope: !isHomePage && mode === "catalog",
		onApplyScope: scope.set,
	});

	const analytics = useSearchAnalytics({ open: dialog.open });

	const onResults = useCallback(
		(query: string, rows: RowSearchResult[]) => analytics.onResults(query, rows, params.catalogName),
		[analytics.onResults, params.catalogName],
	);

	const { data, error, reload } = useSearchRequest({
		gateway,
		params,
		query: searchQuery.settled,
		enabled: dialog.open,
		onResults,
		onError,
	});

	const indexing = useSearchIndexing({
		gateway,
		enabled: dialog.open,
		reindexOnOpen: isWeb || isTauri,
		catalogName: params.catalogName,
		resourceFilter,
		onComplete: reload,
	});

	const closeDialog = useCallback(() => dialog.setOpen(false), [dialog.setOpen]);

	const navigate = useCallback((url: Url) => router.setUrl(url), [router]);

	const onLinkOpen = useSearchLinkOpen({
		isHomePage,
		currentPathname,
		navigate,
		highlightFragment:
			isWeb || isTauri ? highlightFragmentInEditor : isStatic ? highlightFragmentInDocportal : undefined,
		close: closeDialog,
		onLinkClick: analytics.onLinkClick,
	});

	useSearchHotkeys({ onToggleOpen: dialog.toggle, onCycleScope: scope.cycle });

	const { focus, results } = useSearchResults({
		rows: data?.kind === "search" ? data.rows : NO_ROWS,
		onLinkOpen,
	});

	const clear = useCallback(() => {
		setQuery("");
	}, [setQuery]);

	const settledData = searchQuery.delaying ? null : data;
	const settledError = searchQuery.delaying ? null : error;

	const base: SearchStateBase = {
		ai: { available: ai.available, toggle: ai.toggle },
		query: { value: query, set: setQuery },
		indexing,
		dialog: { open: dialog.open, setOpen: dialog.setOpen },
		status: getSearchStatus(!query && !params.propertyFilter, settledData, settledError),
		currentArticleRefPath,
		clear,
		scope: {
			mode,
			value: scope.value,
			available: scope.available,
			set: scope.set,
			isCategory: scope.isCategory,
			showCatalogBreadcrumb: scope.showCatalogBreadcrumb,
		},
		onLinkOpen,
	};

	if (ai.enabled) {
		return { ...base, aiEnabled: true, data: data?.kind === "chat" ? data.nodes : null };
	}

	return {
		...base,
		aiEnabled: false,
		property: scope.value === "all" || mode !== "catalog" ? undefined : property,
		data: results,
		resourceFilter: { value: resourceFilter, set: setResourceFilter },
		focus,
	};
};
