import type { CommandTree } from "@app/commands";
import type Application from "@app/types/Application";
import type Context from "@core/Context/Context";
import Path from "@core/FileProvider/Path/Path";
import type { Article } from "@core/FileStructue/Article/Article";
import type ContextualCatalog from "@core/FileStructue/Catalog/ContextualCatalog";
import type { Category } from "@core/FileStructue/Category/Category";
import "@core/utils/asyncUtils";
import type { SearchArticleResult, SearchResultItem } from "@ext/serach/Searcher";
import { agentConfig } from "../../core/agentConfig";
import { AgentArticleParser } from "../parser";
import { CatalogItemLookup } from "./catalogPaths";
import { type ContentMatcher, type LineMatch, LineMatcher } from "./lines";

export type SearchMatch = { line: number | null; text: string; endLine?: number; endText?: string };

export type CatalogSearchResults = { hits: CatalogSearchHit[]; hasMore: boolean };

type CatalogSearchHit = ReturnType<CatalogItemLookup["asAgentJSON"]> & { matches: SearchMatch[] };

type CompactSearchResultsArgs = {
	app: Application;
	ctx: Context;
	commands: CommandTree;
	raw: unknown;
	maxHits: number;
	maxMatchesPerHit: number;
	matcher: ContentMatcher;
};

export class SearchResults {
	static resolveMaxHits(value: unknown): number {
		if (value === undefined || value === null || value === "") return agentConfig.searchHitsDefault;

		const parsed = Number(value);
		if (!Number.isInteger(parsed) || parsed < 1) throw new Error("maxHits must be an integer starting from 1");
		return Math.min(parsed, agentConfig.searchHitsMax);
	}

	static withoutLineNumbers(matches: LineMatch[]): SearchMatch[] {
		return matches.map(({ text, endText }) => (endText ? { line: null, text, endText } : { line: null, text }));
	}

	static async resolveAgentViewMatches(
		openParser: () => Promise<AgentArticleParser>,
		matcher: ContentMatcher,
		maxMatchesPerHit: number,
		fallback: SearchMatch[],
	): Promise<SearchMatch[]> {
		try {
			const parser = await openParser();
			const matches = LineMatcher.findAll(await parser.getMarkdownForAgent(), matcher, maxMatchesPerHit);
			return matches.length ? matches : fallback;
		} catch {
			return fallback;
		}
	}

	static async compact(args: CompactSearchResultsArgs): Promise<CatalogSearchResults> {
		const { raw, maxHits } = args;
		if (!Array.isArray(raw)) return { hits: [], hasMore: false };

		const articles = raw.filter((x): x is SearchArticleResult => !!x && typeof x === "object" && "refPath" in x);
		const page = articles.slice(0, maxHits);
		const resolved: (CatalogSearchHit | null)[] = new Array(page.length);
		const catalogs = new Map<string, ContextualCatalog>();

		await page.forEachAsync(async (hit, index) => {
			const catalogName = hit.catalog.name;
			let catalog = catalogs.get(catalogName);
			if (!catalog) {
				catalog = await args.app.wm.current().getCatalog(catalogName, args.ctx);
				catalogs.set(catalogName, catalog);
			}

			resolved[index] = await SearchResults._compactHit(args, catalog, hit);
		});

		return {
			hits: resolved.filter((hit): hit is CatalogSearchHit => hit !== null),
			hasMore: articles.length > maxHits,
		};
	}

	private static async _compactHit(
		args: CompactSearchResultsArgs,
		catalog: ContextualCatalog,
		hit: SearchArticleResult,
	): Promise<CatalogSearchHit | null> {
		const slash = hit.refPath.indexOf("/");
		const itemPath = slash === -1 ? "" : hit.refPath.slice(slash + 1);
		if (!itemPath) return null;

		const catalogName = hit.catalog.name;
		const item = catalog.findItemByItemPath(new Path(hit.refPath));
		const lookup = item
			? CatalogItemLookup.fromCatalogItem(catalog, item)
			: new CatalogItemLookup(catalogName, itemPath);

		const indexMatches = SearchResults._indexSnippetMatches(hit, args.maxMatchesPerHit);
		if (!item) return { ...lookup.asAgentJSON(), matches: indexMatches };

		const matches = await SearchResults.resolveAgentViewMatches(
			() => AgentArticleParser.open(args.app, args.ctx, args.commands, catalog, item as Article | Category),
			args.matcher,
			args.maxMatchesPerHit,
			indexMatches,
		);

		return { ...lookup.asAgentJSON(), matches };
	}

	private static _indexSnippetMatches(hit: SearchArticleResult, maxMatchesPerHit: number): SearchMatch[] {
		const snippets: string[] = [];
		SearchResults._collectSnippets(hit.items, snippets);

		return snippets
			.filter(Boolean)
			.slice(0, maxMatchesPerHit)
			.map((text) => ({ line: null, text: text.slice(0, agentConfig.searchMatchLineMaxChars) }));
	}

	private static _collectSnippets(items: SearchResultItem[], acc: string[]): void {
		for (const item of items) {
			if ("searchText" in item && item.searchText) {
				acc.push(item.searchText);
			}
			if ("items" in item && item.items.length) {
				SearchResults._collectSnippets(item.items as SearchResultItem[], acc);
			}
		}
	}
}
