import type { SearchState } from "@ext/serach/components/hooks/useSearchState";
import { createContext, useContext } from "react";

const SearchContext = createContext<SearchState | null>(null);

export interface SearchProviderProps {
	state: SearchState;
	children: React.ReactNode;
}

export const SearchProvider = (props: SearchProviderProps) => {
	const { state, children } = props;

	return <SearchContext.Provider value={state}>{children}</SearchContext.Provider>;
};

export const useSearch = () => {
	const ctx = useContext(SearchContext);
	if (!ctx) throw new Error("useSearch must be used within SearchProvider");
	return ctx;
};
