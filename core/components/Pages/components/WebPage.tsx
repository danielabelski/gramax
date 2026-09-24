import HomePage from "@components/HomePage/HomePage";
import CatalogComponent from "@components/Layouts/CatalogLayout/CatalogComponent";
import type { PageProps } from "@components/Pages/models/Pages";
import type { ArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import ArticleViewContainer from "@core-ui/ContextServices/views/articleView/ArticleViewContainer";
import { ArticleViewKeyProvider } from "@core-ui/ContextServices/views/articleView/ArticleViewKey";
import useFsEventsWatcher from "@ext/Watchers/useFsEventsWatcher";
import { memo } from "react";

const CatalogPage = ({ data, viewKey }: { data: ArticlePageData; viewKey: string }) => {
	return (
		<CatalogComponent data={data}>
			<ArticleViewKeyProvider value={viewKey}>
				<ArticleViewContainer data={data} key={viewKey} />
			</ArticleViewKeyProvider>
		</CatalogComponent>
	);
};

export const WebPage = memo(({ data, viewKey }: { data: PageProps; viewKey: string }) => {
	useFsEventsWatcher();
	return data.page === "article" ? <CatalogPage data={data.data} viewKey={viewKey} /> : <HomePage data={data.data} />;
});
