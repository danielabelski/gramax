import type { SearchKeyboard } from "@ext/serach/components/hooks/useSearchKeyboard";
import { createContext, type ReactNode, type RefObject, useContext } from "react";

const SearchKeyboardContext = createContext<SearchKeyboard | null>(null);

export interface SearchKeyboardProviderProps {
	keyboard: SearchKeyboard;
	children: ReactNode;
}

export const SearchKeyboardProvider = (props: SearchKeyboardProviderProps) => {
	const { keyboard, children } = props;

	return <SearchKeyboardContext.Provider value={keyboard}>{children}</SearchKeyboardContext.Provider>;
};

export const useSearchQueryInputRef = (): RefObject<HTMLInputElement> => {
	const keyboard = useContext(SearchKeyboardContext);
	if (!keyboard) throw new Error("useSearchQueryInputRef must be used within SearchKeyboardProvider");
	return keyboard.inputRef;
};
