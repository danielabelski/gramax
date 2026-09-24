import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import type { LeftNavViewContentComponent } from "@core-ui/ContextServices/views/leftNavView/LeftNavViewContentService";
import { FavoriteArticlesNavigation } from "@ext/article/Favorite/components/FavoriteArticlesNavigation";
import t from "@ext/localization/locale/translate";
import { NavigationTree } from "@ext/navigation/catalog/SidebarNavigation/components/edit/NavigationTree";
import { ReadonlyNavigationTree } from "@ext/navigation/catalog/SidebarNavigation/components/render/ReadonlyNavigationTree";

const LeftNavigationContent: LeftNavViewContentComponent = ({ itemLinks }) => {
	const isReadOnly = PageDataContextService.value.conf.isReadOnly;
	const favoriteArticles = <FavoriteArticlesNavigation />;

	return (
		<nav aria-label={t("catalog.navigation")}>
			{isReadOnly ? (
				<ReadonlyNavigationTree beforeGroups={favoriteArticles} items={itemLinks} />
			) : (
				<NavigationTree beforeGroups={favoriteArticles} items={itemLinks} />
			)}
		</nav>
	);
};

export default LeftNavigationContent;
