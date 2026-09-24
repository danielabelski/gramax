import type { Article } from "@core/FileStructue/Article/Article";
import type { ArticleFilter, Catalog } from "@core/FileStructue/Catalog/Catalog";
import type { CatalogItemSearcher } from "@core/FileStructue/Catalog/CatalogItemSearcher";
import type { Category } from "@core/FileStructue/Category/Category";
import type { Item, ItemProps } from "@core/FileStructue/Item/Item";
import { ItemType } from "@core/FileStructue/Item/ItemType";
import type { ContentLanguage } from "@ext/localization/core/model/Language";
import assert from "assert";
import { type AliasEntry, AliasIndex, type AliasSource, aliasPathOf } from "./AliasIndex";
import { canonicalMoved, dropAutoAlias, hasManualAlias } from "./aliasAutowrite";

type AliasConflict = { item: Item; kind: "path" | "alias" };

export class CatalogAliases {
	private _index: AliasIndex = null;

	constructor(
		private readonly _catalog: Catalog,
		private readonly _searcher: CatalogItemSearcher,
	) {}

	invalidate(): void {
		this._index = null;
	}

	findArticle(logicPath: string, filters: ArticleFilter[] = [], root?: Category): Article {
		const resolvedRoot = root ?? this._catalog.getRootCategory();
		let target = this.index.resolve(logicPath);

		const mainRoot = this._catalog.getRootCategory().logicPath;
		if (
			!target &&
			resolvedRoot.logicPath !== mainRoot &&
			`${logicPath}/`.startsWith(`${resolvedRoot.logicPath}/`)
		) {
			const tail = logicPath.slice(resolvedRoot.logicPath.length + 1);
			const mainTarget = this.index.resolve(`${mainRoot}/${tail}`);
			if (mainTarget && `${mainTarget}/`.startsWith(`${mainRoot}/`))
				target = `${resolvedRoot.logicPath}/${mainTarget.slice(mainRoot.length + 1)}`;
		}

		if (!target || target === logicPath) return null;
		return this._searcher.findItemByLogicPath(resolvedRoot, target, filters) as Article;
	}

	diagnostics() {
		return this.index.diagnostics;
	}

	/**
	 * Aliases are stored in the main-language file only (PRD §6): the redirect is mirrored into every
	 * language URL space, so a translation delegates alias storage to its main-language twin.
	 */
	ownerFor(logicPath: string): Item {
		const root = this._catalog.getRootCategory();
		const mainPath = this._mainLanguagePath(logicPath);
		const owner = mainPath ? this._searcher.findItemByLogicPath(root, mainPath, []) : null;
		return owner ?? this._searcher.findItemByLogicPath(root, logicPath, []);
	}

	/** Same as ownerFor, without a lookup when the item already is the owner — it is on every article render. */
	ownerOf(item: Item): Item {
		const mainPath = this._mainLanguagePath(item.logicPath);
		if (!mainPath) return item;
		return this._searcher.findItemByLogicPath(this._catalog.getRootCategory(), mainPath, []) ?? item;
	}

	/** Alias paths are relative to the main-language root, whichever language the item itself lives in. */
	relativePath(logicPath: string): string {
		return this._catalog.relativeLogicPath(this._mainLanguagePath(logicPath) ?? logicPath);
	}

	/** Writes the alias list an editor submitted for `item` onto the item that owns aliases. */
	async apply(item: Item, aliases: ItemProps["aliases"]): Promise<void> {
		const owner = this.ownerOf(item);
		this._write(owner, aliases);
		await this._dropTranslationAliases(owner, item);
		if (owner !== item) await owner.save();
		this.invalidate();
	}

	/** Alias list to show for `item`: a translation shows the aliases of its main-language twin. */
	listFor(item: Item): AliasEntry[] {
		return this.ownerOf(item).props.aliases ?? [];
	}

	assertNotManual(alias: string, mover: Item): void {
		if (!alias) return;
		for (const item of this._catalog.getItems([])) {
			if (item === mover) continue;
			assert(
				!hasManualAlias(item.props, alias),
				`Path '${alias}' is a manual alias of '${this._catalog.relativeLogicPath(item.logicPath)}'. Remove that alias or pick another name.`,
			);
		}
	}

	assertFree(alias: string, forItem: Item): void {
		const conflict = this._findConflict(alias, forItem);
		if (!conflict) return;
		assert(conflict.kind !== "path", `Alias '${alias}' equals the path of an existing item`);
		assert(
			!conflict,
			`Alias '${alias}' is already used by '${this._catalog.relativeLogicPath(conflict.item.logicPath)}'`,
		);
	}

	// True when `alias` is the real path of another item, i.e. the alias resolves nothing.
	shadowsRealItem(alias: string, forItem: Item): boolean {
		return this._findConflict(alias, forItem)?.kind === "path";
	}

	// `newOwner` has taken `alias` — either as its own alias entry or as the path it now
	// lives at. No other item may keep an auto claim on it: the product wrote those claims
	// on earlier renames, and a claim on a taken path resolves nothing while still showing
	// up in the healthcheck. Manual claims stay — the user wrote them, the user removes them.
	async stealAuto(alias: string, newOwner: Item): Promise<void> {
		if (!alias) return;
		for (const item of this._catalog.getItems([])) {
			if (item === newOwner) continue;
			if (dropAutoAlias(item.props, alias)) await item.save();
		}
	}

	async dropConflicting(item: Item): Promise<void> {
		if (!Array.isArray(item.props.aliases)) return;
		const own = this.relativePath(item.logicPath);
		const kept = item.props.aliases.filter((entry) => {
			const path = aliasPathOf(entry);
			return path && path !== own && !this._findConflict(path, item);
		});
		if (kept.length === item.props.aliases.length) return;
		if (kept.length) item.props.aliases = kept;
		else delete item.props.aliases;
		await item.save();
		this._searcher.resetCache();
		this.invalidate();
	}

	private _write(owner: Item, aliases: ItemProps["aliases"]): void {
		if (!Array.isArray(aliases) || !aliases.length) {
			delete owner.props.aliases;
			return;
		}
		const own = this.relativePath(owner.logicPath);
		// A props save resubmits the aliases the owner already holds: a duplicate claim it came in with
		// (import, merge) must not block an edit that touches no alias (gh#934). New aliases are checked.
		const held = new Set((Array.isArray(owner.props.aliases) ? owner.props.aliases : []).map(aliasPathOf));
		const seen = new Set<string>();
		const entries: ItemProps["aliases"] = [];
		for (const entry of aliases) {
			const path = aliasPathOf(entry);
			if (!path || seen.has(path)) continue;
			seen.add(path);
			assert(path !== own, `Alias '${path}' equals the item's own path`);
			if (typeof entry === "string") {
				if (!held.has(path)) this.assertFree(path, owner);
				else assert(!this.shadowsRealItem(path, owner), `Alias '${path}' equals the path of an existing item`);
				entries.push(path);
				continue;
			}
			// A shadowed auto alias is a stale claim left by an earlier product rename.
			// Drop it instead of blocking every subsequent properties save on its owner.
			if (this.shadowsRealItem(path, owner)) continue;
			if (!held.has(path)) this.assertFree(path, owner);
			const { moved: rawMoved, ...rest } = entry;
			const moved = canonicalMoved(rawMoved);
			entries.push(moved ? { ...rest, path, moved } : { ...rest, path });
		}
		if (entries.length) owner.props.aliases = entries;
		else delete owner.props.aliases;
	}

	/** Main-language logic path of a translated item, or null when the item already is the main-language one. */
	private _mainLanguagePath(logicPath: string): string {
		const { language, supportedLanguages } = this._catalog.props;
		if (!language) return null;
		const [head, ...rest] = this._catalog.relativeLogicPath(logicPath).split("/");
		if (!rest.length || head === language || !supportedLanguages?.includes(head as ContentLanguage)) return null;
		return `${this._catalog.getRootCategory().logicPath}/${rest.join("/")}`;
	}

	private get index(): AliasIndex {
		this._index ??= AliasIndex.build(this._collectSources());
		return this._index;
	}

	private _collectSources(): AliasSource[] {
		const root = this._catalog.getRootCategory();
		if (!root) return [];
		const prefix = (raw: AliasEntry) => {
			const relative = aliasPathOf(raw);
			if (!relative) return null;
			const path = `${root.logicPath}/${relative}`;
			return typeof raw === "string" ? path : { ...raw, path };
		};
		return this._catalog.getItems([]).map((item) => ({
			logicPath: item.logicPath,
			isCategory: item.type === ItemType.category,
			aliases: Array.isArray(item.props.aliases) ? item.props.aliases.map(prefix).filter(Boolean) : undefined,
		}));
	}

	/** Older versions wrote aliases into the translation files as well — the first save cleans that up. */
	private async _dropTranslationAliases(owner: Item, edited: Item): Promise<void> {
		for (const item of this._catalog.getItems([])) {
			if (item === owner || !item.props.aliases) continue;
			if (this.ownerOf(item) !== owner) continue;
			delete item.props.aliases;
			if (item !== edited) await item.save();
		}
	}

	private _findConflict(alias: string, forItem: Item): AliasConflict | null {
		if (!alias) return null;
		const owner = this.ownerOf(forItem);
		let aliasConflict: AliasConflict | null = null;

		for (const item of this._catalog.getItems([])) {
			if (item === forItem) continue;
			// every language version of the same article is one entity as far as aliases go
			if (this.ownerOf(item) === owner) continue;
			if (this._catalog.relativeLogicPath(item.logicPath) === alias) return { item, kind: "path" };
			if (
				!aliasConflict &&
				Array.isArray(item.props.aliases) &&
				item.props.aliases.some((e) => aliasPathOf(e) === alias)
			)
				aliasConflict = { item, kind: "alias" };
		}
		return aliasConflict;
	}
}
