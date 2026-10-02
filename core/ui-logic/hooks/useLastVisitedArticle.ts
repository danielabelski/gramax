import type { ArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import FetchService from "@core-ui/ApiServices/FetchService";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useEffect } from "react";

// The catalog card leads to the article its reader was last shown, so it is recorded once the article
// is on screen: a read of a page can be dropped or overtaken before anyone sees it.
export const useLastVisitedArticle = ({ articleProps }: ArticlePageData) => {
	const { isStatic, isStaticCli } = usePlatform();
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { pathname, errorCode, welcome } = articleProps;

	useEffect(() => {
		if (isStatic || isStaticCli || errorCode || welcome) return;
		const body = JSON.stringify({ pathname });
		void FetchService.fetch(apiUrlCreator.setLastVisitedArticle(), body, MimeTypes.json, undefined, false);
	}, [isStatic, isStaticCli, errorCode, welcome, pathname]);
};
