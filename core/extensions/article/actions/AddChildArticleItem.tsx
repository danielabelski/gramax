import CatalogItem from "@components/Actions/CatalogItems/Base";
import Icon from "@components/Atoms/Icon";
import t from "@ext/localization/locale/translate";
import { useCreateArticle } from "@ext/navigation/catalog/SidebarNavigation/hooks/useCreateArticle";
import { useNavigationItem } from "@ext/navigation/catalog/SidebarNavigation/hooks/useNavigationItem";
import type { ItemLink } from "@ext/navigation/NavigationLinks";

// The row's plus reached without a pointer: a menu item works by touch and by keyboard.
const AddChildArticleItem = ({ itemLink }: { itemLink: ItemLink }) => {
	const createArticle = useCreateArticle();
	const { children } = useNavigationItem(itemLink.ref.path);

	return (
		<CatalogItem
			renderLabel={(Item) => (
				<Item onSelect={() => createArticle(itemLink.ref.path, children.at(-1))}>
					<Icon code="plus" />
					{t("article.add-child")}
				</Item>
			)}
		/>
	);
};

export default AddChildArticleItem;
