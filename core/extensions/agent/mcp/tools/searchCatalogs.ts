import type { CommandTree } from "@app/commands";
import { agentConfig } from "../../core/agentConfig";
import { AgentArticleParser } from "../parser";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { CatalogItemLookup } from "../utils/catalogPaths";
// import { buildPath } from "../utils/catalogPaths";
import { type ContentMatcher, type LineMatch, LineMatcher } from "../utils/lines";
import { type CatalogSearchResults, SearchResults } from "../utils/searchResults";

type SearchCatalogsInput = {
	query: string;
	catalogName?: string;
	regex?: boolean;
	maxHits?: number;
	// scopePath?: string;
};

// function normalizeScopePath(input: string): string {
// 	const normalized = input.trim().replace(/^[/\\]+/, "").replace(/\\/g, "/").replace(/\/+$/, "");
// 	if (!normalized || normalized.endsWith(".md")) return normalized;
// 	return `${normalized}/_index.md`;
// }

function timeoutSignal(ms: number): AbortSignal | undefined {
	if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return undefined;
	return AbortSignal.timeout(ms);
}

function parseNdjsonDoneLine(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed) return false;
	try {
		const item = JSON.parse(trimmed) as { type?: string };
		return item.type === "done";
	} catch {
		return false;
	}
}

function followParentAbort(parent: AbortSignal | undefined, child: AbortController): () => void {
	if (!parent) return () => {};
	const onAbort = () => child.abort();
	if (parent.aborted) {
		child.abort();
	} else {
		parent.addEventListener("abort", onAbort, { once: true });
	}
	return () => parent.removeEventListener("abort", onAbort);
}

async function waitUntilIndexingProgressDone(
	search: CommandTree["search"],
	parentSignal: AbortSignal | undefined,
): Promise<void> {
	const ac = new AbortController();
	const unfollow = followParentAbort(parentSignal, ac);
	try {
		if (ac.signal.aborted) {
			throw new DOMException("The operation was aborted.", "AbortError");
		}
		const { iterator } = await search.getIndexingProgress.do({
			type: undefined,
			resourceFilter: undefined,
			signal: ac.signal,
		});
		let buffer = "";
		try {
			for await (const chunk of iterator) {
				buffer += chunk;
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const line of lines) {
					if (parseNdjsonDoneLine(line)) {
						ac.abort();
						return;
					}
				}
			}
		} catch (e) {
			if (e instanceof DOMException && e.name === "AbortError") return;
			throw e;
		}
	} finally {
		unfollow();
	}
}

async function scanCatalogWithMatcher(
	{ app, ctx, commands }: ToolExecutionContext,
	catalogName: string,
	matcher: ContentMatcher,
	maxHits: number,
): Promise<CatalogSearchResults> {
	const { searchCatalogsMaxMatchesPerHit, searchScanDeadlineMs } = agentConfig;
	const wm = app.wm.current();
	const wmFp = wm.getFileProvider();
	const catalog = await wm.getCatalog(catalogName, ctx);
	const hits: CatalogSearchResults["hits"] = [];
	const deadline = Date.now() + searchScanDeadlineMs;

	for (const item of catalog.getContentItems()) {
		if (Date.now() > deadline) return { hits, hasMore: true };

		let rawMatches: LineMatch[];
		try {
			rawMatches = LineMatcher.findAll(await wmFp.read(item.ref.path), matcher, searchCatalogsMaxMatchesPerHit);
		} catch {
			continue;
		}
		if (!rawMatches.length) continue;
		if (hits.length === maxHits) return { hits, hasMore: true };

		const matches = await SearchResults.resolveAgentViewMatches(
			() => AgentArticleParser.open(app, ctx, commands, catalog, item),
			matcher,
			searchCatalogsMaxMatchesPerHit,
			SearchResults.withoutLineNumbers(rawMatches),
		);
		hits.push({ ...CatalogItemLookup.fromCatalogItem(catalog, item).asAgentJSON(), matches });
	}

	return { hits, hasMore: false };
}

export async function runSearchCatalogs(context: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { app, ctx, input, commands } = context;
	const { query, catalogName, regex, maxHits } = input as SearchCatalogsInput;
	const cat = catalogName?.trim();
	// const scopeRaw = scopePath?.trim();
	// if (scopeRaw && !cat) {
	// 	return fail("scopePath is set without catalogName — provide catalogName.");
	// }
	const queryText = query.trim();
	if (!queryText) return fail("query is required");
	// const normalizedScopePath = scopeRaw ? normalizeScopePath(scopeRaw) : undefined;
	// const gramaxSearchRootRef = cat && normalizedScopePath ? buildPath(cat, normalizedScopePath) : undefined;
	const isRegex = regex === true;
	if (isRegex && !cat) return fail("catalogName is required when regex is true");

	let hitsLimit: number;
	let matcher: ContentMatcher;
	try {
		hitsLimit = SearchResults.resolveMaxHits(maxHits);
		matcher = LineMatcher.build(queryText, isRegex);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(isRegex ? `Invalid search request: ${msg}` : msg);
	}

	if (isRegex) {
		try {
			const results = await scanCatalogWithMatcher(context, cat, matcher, hitsLimit);
			return ok(results.hasMore ? results : { hits: results.hits });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fail(`Failed to search catalogs: ${msg}`);
		}
	}

	const { searchCatalogsMaxMatchesPerHit, searchTimeoutMs, searchIndexProgressWaitMs } = agentConfig;
	const progressWaitSignal = timeoutSignal(searchIndexProgressWaitMs);

	try {
		await commands.search.resetSearchData.do({
			type: undefined,
			force: false,
			catalogName: cat || undefined,
		});
		await waitUntilIndexingProgressDone(commands.search, progressWaitSignal);
		const searchSignal = timeoutSignal(searchTimeoutMs);
		const results = await commands.search.searchCommand.do({
			ctx,
			signal: searchSignal,
			query: queryText,
			catalogName: cat || undefined,
			articleRefFilter: undefined,
			propertyFilter: undefined,
			resourceFilter: undefined,
			articlesLanguage: undefined,
		});
		const compacted = await SearchResults.compact({
			app,
			ctx,
			commands,
			raw: results,
			maxHits: hitsLimit,
			maxMatchesPerHit: searchCatalogsMaxMatchesPerHit,
			matcher,
		});
		return ok(compacted.hasMore ? compacted : { hits: compacted.hits });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to search catalogs: ${msg}`);
	}
}
