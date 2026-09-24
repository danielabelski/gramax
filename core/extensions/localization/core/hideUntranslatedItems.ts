import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type { Category } from "@core/FileStructue/Category/Category";
import type { Item } from "@core/FileStructue/Item/Item";
import { ItemType } from "@core/FileStructue/Item/ItemType";

// Reader-side counterpart of `markUntranslatedItems`: on the portal an untranslated article must not
// be listed at all, not merely borrow the default-language title (#859).
//
// The `item-filter` event cannot do it. It fires while the tree is still being hydrated, one item at
// a time, and the untranslated marker can only be computed once the whole tree is there — the
// default-language counterpart may well be hydrated after the translation stub. So the marker is
// recomputed on `catalog-read` and the marked items are pruned here, right after.
export const hideUntranslatedItems = (catalog: Catalog) => {
	const defaultLanguage = catalog.props.language;
	if (!defaultLanguage) return;

	let removedAny = false;

	for (const language of catalog.props.supportedLanguages ?? []) {
		if (language === defaultLanguage) continue;

		const languageCategory = catalog.findArticle(`${catalog.name}/${language}`, [
			(i) => i.type === ItemType.category,
		]) as Category;
		if (!languageCategory) continue;

		if (pruneCategory(languageCategory)) removedAny = true;
	}

	// `findArticle` above filled the searcher cache, and pruning invalidates it: a pruned item still
	// points at its old parent, so a cached lookup would keep resolving an item that is no longer
	// part of the catalog.
	if (removedAny) catalog.resetSearcherCache();
};

const pruneCategory = (category: Category): boolean => {
	const items = category.items;
	let removedAny = false;

	// Deepest first: whether an untranslated category may stay depends on what survives inside it.
	for (const item of [...items]) {
		if (item.type === ItemType.category && pruneCategory(item as Category)) removedAny = true;
		if (!shouldHide(item)) continue;

		items.splice(items.indexOf(item), 1);
		removedAny = true;
	}

	return removedAny;
};

// A category keeps its place while anything translated is still reachable under it — hiding it would
// hide translated articles along with it.
const shouldHide = (item: Item): boolean => {
	if (!item.props.external) return false;
	if (item.type !== ItemType.category) return true;
	return !hasTranslatedItem(item as Category);
};

const hasTranslatedItem = (category: Category): boolean =>
	category.items.some((item) =>
		item.type === ItemType.category ? hasTranslatedItem(item as Category) : !item.props.external,
	);

export default hideUntranslatedItems;
