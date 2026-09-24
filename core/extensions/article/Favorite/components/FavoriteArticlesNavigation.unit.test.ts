import { ItemType } from "@core/FileStructue/Item/ItemType";
import type { CategoryLink, ItemLink } from "@ext/navigation/NavigationLinks";
import { selectFavoriteArticleLinks } from "./FavoriteArticlesNavigation";

const article = (path: string, title: string): ItemLink =>
	({
		type: ItemType.article,
		title,
		pathname: `/catalog/${path}`,
		ref: { path },
	}) as ItemLink;

const folder = (path: string, items: ItemLink[]): CategoryLink =>
	({
		type: ItemType.category,
		title: path,
		pathname: `/catalog/${path}`,
		ref: { path },
		items,
	}) as CategoryLink;

describe("selectFavoriteArticleLinks", () => {
	test("finds nested articles in favorite order and skips missing paths", () => {
		const first = article("first.md", "First");
		const second = article("folder/second.md", "Second");

		const result = selectFavoriteArticleLinks(
			[folder("folder", [second]), first],
			["first.md", "deleted.md", "folder/second.md"],
		);

		expect(result).toEqual([first, second]);
	});
});
