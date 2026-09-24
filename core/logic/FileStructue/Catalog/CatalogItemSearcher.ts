import Path from "@core/FileProvider/Path/Path";
import type { Article } from "@core/FileStructue/Article/Article";
import type { ArticleFilter, Catalog, ItemFilter } from "@core/FileStructue/Catalog/Catalog";
import type { Category } from "@core/FileStructue/Category/Category";
import type { Item } from "@core/FileStructue/Item/Item";
import type { ItemRef } from "@core/FileStructue/Item/ItemRef";
import { ItemType } from "@core/FileStructue/Item/ItemType";

export class CatalogItemSearcher {
	private readonly _weak: WeakRef<Catalog>;
	private readonly _cachedItemPath = new Map<string, WeakRef<Item>>();
	private readonly _cachedLogicPath = new Map<string, WeakRef<Item>>();
	private _itemPathIndex: Map<string, WeakRef<Item>>;
	private _logicPathIndex: Map<string, WeakRef<Item>[]>;

	private _cacheHit = 0;
	private _cacheMiss = 0;

	constructor(catalog: Catalog) {
		this._weak = new WeakRef(catalog);
	}

	get cacheHit() {
		return this._cacheHit / (this._cacheHit + this._cacheMiss);
	}

	resetCache(paths?: string[]) {
		this._itemPathIndex = undefined;
		this._logicPathIndex = undefined;

		if (!paths) {
			this._cachedItemPath.clear();
			this._cachedLogicPath.clear();
			this._cacheHit = 0;
			this._cacheMiss = 0;
			return;
		}

		for (const path of paths) {
			const pathKey = new Path(path).removeExtraSymbols.value;
			const item = this._cachedItemPath.get(pathKey)?.deref();
			if (item) this._cachedLogicPath.delete(item.logicPath);
			this._cachedItemPath.delete(pathKey);
		}
	}

	findItemByPath(path: Path | ItemRef, type?: ItemType): Item {
		const resolvedPath = path instanceof Path ? path : path?.path;
		if (!resolvedPath) return null;
		const pathKey = resolvedPath.removeExtraSymbols.value;

		const filter = [(i: Item) => (type ? i.type === type : true) && i.ref.path.compare(resolvedPath)];

		const cached = this._cachedItemPath.get(pathKey)?.deref();
		if (cached && this._assertFilters(cached as Article, filter)) {
			this._cacheHit++;
			return cached;
		}

		this._cacheMiss++;

		this._ensureIndexes();
		const indexedItemRef = this._itemPathIndex.get(pathKey);
		const indexedItem = indexedItemRef?.deref();
		if (indexedItemRef && !indexedItem) this._itemPathIndex.delete(pathKey);
		const item = indexedItem && (!type || indexedItem.type === type) ? indexedItem : null;

		if (item) this._cachedItemPath.set(pathKey, new WeakRef(item));
		return item;
	}

	findItemByLogicPath(root: Category, logicPath: string, filters: ArticleFilter[] = []): Item {
		const cached = this._cachedLogicPath.get(logicPath)?.deref();
		if (cached && this._isWithinRoot(cached, root) && !this._findRejectedItem(cached, root, filters)) {
			this._cacheHit++;
			return cached;
		}

		this._cacheMiss++;

		this._ensureIndexes();
		const item = this._getLiveLogicPathItems(logicPath).find((candidate) => this._isWithinRoot(candidate, root));
		if (!item) {
			const rejectedCategory = this._findRejectedPrefixCategory(logicPath, root, filters);
			return rejectedCategory ? this._findErrorArticle(rejectedCategory, filters) : null;
		}

		const rejectedItem = this._findRejectedItem(item, root, filters);
		if (rejectedItem) return this._findErrorArticle(rejectedItem as Article, filters);

		if (item.type === ItemType.category && (item as Category).parent) {
			this._cachedLogicPath.set(item.logicPath, new WeakRef(item));
			return item as Article;
		}

		if (item.type === ItemType.article) {
			this._cachedLogicPath.set(item.logicPath, new WeakRef(item));
			return item as Article;
		}

		return this._findItem(item as Category, filters, [(a) => !!a.parent]) as Article;
	}

	private get catalog(): Catalog {
		return this._weak.deref();
	}

	private _ensureIndexes() {
		if (this._itemPathIndex && this._logicPathIndex) return;

		this._itemPathIndex = new Map();
		this._logicPathIndex = new Map();
		this._indexItem(this.catalog.getRootCategory());
	}

	private _indexItem(item: Item) {
		const pathKey = item.ref.path.removeExtraSymbols.value;
		if (!this._itemPathIndex.has(pathKey)) this._itemPathIndex.set(pathKey, new WeakRef(item));
		const logicPathItems = this._logicPathIndex.get(item.logicPath);
		if (logicPathItems) logicPathItems.push(new WeakRef(item));
		else this._logicPathIndex.set(item.logicPath, [new WeakRef(item)]);

		if (item.type === ItemType.category) {
			for (const child of (item as Category).items) this._indexItem(child);
		}
	}

	private _isWithinRoot(item: Item, root: Category): boolean {
		let current: Item = item;
		while (current) {
			if (current === root) return true;
			current = current.parent;
		}
		return false;
	}

	private _findRejectedItem(item: Item, root: Category, filters: ArticleFilter[]): Item {
		const path: Item[] = [];
		let current: Item = item;
		while (current) {
			path.push(current);
			if (current === root) break;
			current = current.parent;
		}

		for (let index = path.length - 1; index >= 0; index--) {
			if (!this._assertFilters(path[index] as Article, filters)) return path[index];
		}
	}

	private _findRejectedPrefixCategory(logicPath: string, root: Category, filters: ArticleFilter[]): Category {
		const parts = logicPath.split("/");
		for (let length = 0; length <= parts.length; length++) {
			const prefix = parts.slice(0, length).join("/");
			const category = this._getLiveLogicPathItems(prefix)?.find(
				(item) => item.type === ItemType.category && this._isWithinRoot(item, root),
			) as Category;
			if (category && !this._assertFilters(category, filters)) return category;
		}
	}

	private _getLiveLogicPathItems(logicPath: string): Item[] {
		const references = this._logicPathIndex.get(logicPath);
		if (!references) return [];

		const liveReferences: WeakRef<Item>[] = [];
		const items: Item[] = [];
		for (const reference of references) {
			const item = reference.deref();
			if (!item) continue;
			liveReferences.push(reference);
			items.push(item);
		}

		if (liveReferences.length === 0) this._logicPathIndex.delete(logicPath);
		else if (liveReferences.length !== references.length) this._logicPathIndex.set(logicPath, liveReferences);
		return items;
	}

	private _findItem(root: Category, parentFilters: ArticleFilter[] = [], itemFilters: ArticleFilter[] = []): Item {
		if (this._assertFilters(root, [...parentFilters, ...itemFilters])) return root;

		for (const item of root.items) {
			if (item.type !== ItemType.category) {
				if (this._assertFilters(item as Article, [...parentFilters, ...itemFilters])) return item;
			} else {
				if (this._assertFilters(item as Category, parentFilters)) {
					const article = this._findItem(item as Category, parentFilters, itemFilters) as Article;
					if (article) return article;
				}
			}
		}
		return null;
	}

	private _findErrorArticle(article: Article, filters: ArticleFilter[]) {
		const filter = filters.find(
			(f): f is ItemFilter => !f(article, this.catalog) && !!(f as ItemFilter).getErrorArticle,
		);
		if (filter) return filter.getErrorArticle(article.logicPath);
	}

	private _assertFilters(article: Article, filters: ArticleFilter[]) {
		return !filters || filters.every((f) => f(article, this.catalog));
	}
}
