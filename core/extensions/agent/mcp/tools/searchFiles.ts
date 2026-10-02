import { agentConfig } from "../../core/agentConfig";
import { FileConverter } from "../parser";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";
import { type LineMatch, LineMatcher } from "../utils/lines";
import { SearchResults } from "../utils/searchResults";

type SearchFilesInput = {
	query: string;
	catalogName: string;
	maxMatches?: number;
	maxHits?: number;
	regex?: boolean;
};

export async function runSearchFiles({ app, ctx, input }: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { query, catalogName, maxMatches, maxHits, regex } = input as SearchFilesInput;
	const queryText = query.trim();
	if (!queryText) return fail("query is required");
	const targetCatalogName = typeof catalogName === "string" ? catalogName.trim() : "";
	if (!targetCatalogName) return fail("catalogName is required");

	const wm = app.wm.current();
	const wmFp = wm.getFileProvider();
	const { searchFilesMaxMatchesDefault, searchFilesMaxMatchesLimit, searchScanDeadlineMs } = agentConfig;
	const requested = Number(maxMatches);
	const matchesPerHit = Number.isFinite(requested)
		? Math.min(Math.max(Math.floor(requested), 1), searchFilesMaxMatchesLimit)
		: searchFilesMaxMatchesDefault;
	const hits: { catalogName: string; filePath: string; matches: LineMatch[] }[] = [];
	let hasMore = false;

	let hitsLimit: number;
	let matcher: ReturnType<typeof LineMatcher.build>;
	try {
		hitsLimit = SearchResults.resolveMaxHits(maxHits);
		matcher = LineMatcher.build(queryText, regex === true);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(regex === true ? `Invalid search request: ${msg}` : msg);
	}

	try {
		const catalog = await wm.getCatalog(targetCatalogName, ctx);
		const dirs = [catalog.basePath];
		const deadline = Date.now() + searchScanDeadlineMs;

		while (dirs.length > 0 && !hasMore) {
			const dir = dirs.pop();
			if (!dir) break;

			for (const item of await wmFp.getItems(dir)) {
				if (Date.now() > deadline) {
					hasMore = true;
					break;
				}

				const relativePath = catalog.getRepositoryRelativePath(item.path).value;
				const isExcluded = agentConfig.repoExcludedPathPatterns.some((pattern) => pattern.test(relativePath));
				if (isExcluded) {
					continue;
				}

				if (item.type === "dir") {
					dirs.push(item.path);
					continue;
				}
				if (item.type !== "file") continue;
				const fileName = item.path.nameWithExtension;
				if (
					FileConverter.isBinaryAttachment(fileName) ||
					FileConverter.isImage(fileName) ||
					FileConverter.isConvertible(fileName)
				)
					continue;

				const matches = LineMatcher.findAll(await wmFp.read(item.path), matcher, matchesPerHit);
				if (matches.length === 0) continue;

				if (hits.length === hitsLimit) {
					hasMore = true;
					break;
				}
				hits.push({ catalogName: targetCatalogName, filePath: relativePath, matches });
			}
		}

		return ok(hasMore ? { hits, hasMore } : { hits });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to search repository: ${msg}`);
	}
}
