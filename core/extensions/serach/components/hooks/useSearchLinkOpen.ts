import type Url from "@core-ui/ApiServices/Types/Url";
import type { OnLinkOpen } from "@ext/serach/components/hooks/useSearchResults";
import { useCallback, useRef } from "react";

export interface UseSearchLinkOpenArgs {
	isHomePage: boolean;
	currentPathname?: string;
	navigate: (url: Url) => void;
	highlightFragment?: (text: string, indexInArticle: number) => void;
	close: () => void;
	onLinkClick: (url: string) => void;
}

export const useSearchLinkOpen = (args: UseSearchLinkOpenArgs): OnLinkOpen => {
	const argsRef = useRef(args);
	argsRef.current = args;

	return useCallback((target) => {
		const { isHomePage, currentPathname, navigate, highlightFragment, close, onLinkClick } = argsRef.current;

		onLinkClick(target.pathname);
		navigate(target.url);
		close();

		const isCurrentArticle = !isHomePage && target.pathname === currentPathname;
		if (!isCurrentArticle || !target.fragmentInfo) return;

		highlightFragment?.(target.fragmentInfo.text, target.fragmentInfo.indexInArticle);
	}, []);
};
