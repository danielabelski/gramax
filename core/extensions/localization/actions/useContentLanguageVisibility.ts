import ArticlePropsService from "@core-ui/ContextServices/ArticleProps";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";

export const useContentLanguageVisibility = () => {
	const articleProps = ArticlePropsService.value;
	const { language, supportedLanguages } = useCatalogPropsStore(
		(state) => ({ language: state.data?.language, supportedLanguages: state.data?.supportedLanguages }),
		"shallow",
	);
	const { isNext } = usePlatform();

	return Boolean(
		articleProps &&
			language &&
			articleProps.pathname &&
			!articleProps.welcome &&
			(!isNext || (supportedLanguages?.length ?? 0) >= 2),
	);
};
