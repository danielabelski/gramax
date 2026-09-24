import Path from "@core/FileProvider/Path/Path";
import type { Article } from "@core/FileStructue/Article/Article";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type ContextualCatalog from "@core/FileStructue/Catalog/ContextualCatalog";
import type { Category } from "@core/FileStructue/Category/Category";
import type { Item } from "@core/FileStructue/Item/Item";
import assert from "assert";
import { agentConfig } from "../../core/agentConfig";
import { LinkAdapter } from "../parser/adapters/linkAdapter";

export class CatalogItemLookup {
	readonly catalogName: string;
	readonly itemPath: string;
	readonly title: string;

	constructor(catalogName: string, gramaxItemPath: string, title = "") {
		this.catalogName = CatalogItemLookup.normalizePath(catalogName);
		this.itemPath = CatalogItemLookup.normalizePath(gramaxItemPath);
		this.title = title;
	}

	static fromCatalogItem(catalog: Catalog | ContextualCatalog, item: Item): CatalogItemLookup {
		return new CatalogItemLookup(
			catalog.name,
			catalog.getRepositoryRelativePath(item.ref).value,
			item.getTitle() ?? "",
		);
	}

	static async resolve(
		catalog: Catalog | ContextualCatalog,
		catalogName: string,
		itemPath: string,
	): Promise<{ item: Article | Category; lookup: CatalogItemLookup } | null> {
		const normalized = CatalogItemLookup.normalizePath(itemPath);
		if (normalized.includes(agentConfig.skillPrefix)) {
			const item = await catalog.customProviders.agentResourcesProvider.getSkillArticleByItemPath(normalized);
			if (!item) return null;
			return {
				item,
				lookup: new CatalogItemLookup(catalogName, normalized, item.getTitle() ?? ""),
			};
		}
		const item = CatalogItemLookup.findItem(catalog, normalized);
		if (!item) return null;
		return {
			item: item as Article | Category,
			lookup: CatalogItemLookup.fromCatalogItem(catalog, item),
		};
	}

	asPath(): Path {
		return new Path(`${this.catalogName}/${this.itemPath}`);
	}

	asAgentJSON() {
		return {
			catalogName: this.catalogName,
			itemPath: LinkAdapter.toAgentItemPath(this.itemPath),
			title: this.title,
		};
	}

	static findItem(catalog: Catalog | ContextualCatalog, itemPath: string): Item | null {
		const gramaxItemPath = LinkAdapter.toGramaxItemPath(LinkAdapter.toAgentItemPath(itemPath));
		return catalog.findItemByItemPath(new Path(Path.join(catalog.name, gramaxItemPath))) ?? null;
	}

	static parseItemPath(agentItemPath: string): {
		isCategory: boolean;
		fileName: string;
		parentAgentItemPath: string;
	} {
		const normalized = LinkAdapter.toAgentItemPath(agentItemPath);
		const isCategory = LinkAdapter.isCategory(normalized);
		const path = normalized.replace(/\/+$/, "");
		assert(path, "itemPath must not be empty");
		const slash = path.lastIndexOf("/");
		return {
			isCategory,
			fileName: slash === -1 ? path : path.slice(slash + 1),
			parentAgentItemPath: slash === -1 ? "" : `${path.slice(0, slash)}/`,
		};
	}

	static normalizePath(input: string): string {
		return input
			.trim()
			.replace(/^[/\\]+/, "")
			.replace(/\\/g, "/");
	}

	static assertResolvedUnderPath(basePath: Path, resolvedPath: Path): void {
		const base = basePath.removeExtraSymbols.value;
		const target = resolvedPath.removeExtraSymbols.value;
		assert(
			target.startsWith(base.endsWith("/") ? base : `${base}/`) || target === base,
			"Path resolves outside base path",
		);
	}
}
