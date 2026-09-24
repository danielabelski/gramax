import isMobileService from "@core-ui/ContextServices/isMobileService";
import type { SearchState } from "@ext/serach/components/hooks/useSearchState";
import { SearchContent } from "@ext/serach/components/SearchContent";
import { SearchProvider } from "@ext/serach/components/SearchContext";
import { SearchFooter } from "@ext/serach/components/SearchFooter";
import { SearchHeader } from "@ext/serach/components/SearchHeader";

export interface SearchRootProps {
	state: SearchState;
}

export const SearchRoot = (props: SearchRootProps) => {
	const { state } = props;
	const isMobile = isMobileService.value;

	return (
		<SearchProvider state={state}>
			<SearchHeader />
			<SearchContent />
			{!isMobile && <SearchFooter />}
		</SearchProvider>
	);
};
