import { ItemType } from "@core/FileStructue/Item/ItemType";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { useItemLinks } from "@core-ui/stores/ItemLinksStore/ItemLinksStore.provider";
import FavoriteService from "@ext/article/Favorite/components/FavoriteService";
import type { CategoryLink, ItemLink } from "@ext/navigation/NavigationLinks";
import { FavoriteArticlesNavigationGroup } from "./FavoriteArticlesNavigationGroup";

export const selectFavoriteArticleLinks = (itemLinks: ItemLink[], favoritePaths: string[]): ItemLink[] => {
	const linksByPath = new Map<string, ItemLink>();
	const collectArticles = (links: ItemLink[]) => {
		for (const link of links) {
			linksByPath.set(link.ref.path, link);
			if (link.type === ItemType.category) collectArticles((link as CategoryLink).items ?? []);
		}
	};

	collectArticles(itemLinks);
	return favoritePaths.flatMap((path) => {
		const link = linksByPath.get(path);
		return link ? [link] : [];
	});
};

export const FavoriteArticlesNavigation = () => {
	const { articles } = FavoriteService.value;
	const catalogName = useCatalogPropsStore((state) => state.data?.name);
	const itemLinks = useItemLinks();
	const items = selectFavoriteArticleLinks(itemLinks, articles);

	return <FavoriteArticlesNavigationGroup catalogName={catalogName} items={items} key={catalogName} />;
};
