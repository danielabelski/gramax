import type Path from "@core/FileProvider/Path/Path";
import getPageDataByPathname, { PageDataType } from "@core/RouterPath/logic/getPageDataByPathname";
import type PathnameData from "@core/RouterPath/model/PathnameData";
import parseStorageUrl from "@core/utils/parseStorageUrl";
import type WorkspaceManager from "@ext/workspace/WorkspaceManager";
import { parsePathCandidates } from "./parsePathCandidates";

type ResolvedPath = {
	pageData: Awaited<ReturnType<typeof getPageDataByPathname>>;
	pathnameData: PathnameData;
};

const getManagedStorageDomain = async (wm: WorkspaceManager): Promise<string | null> => {
	const config = await wm.maybeCurrent()?.config();
	const storageUrl = config?.enterprise?.gesUrl || config?.enterpriseCloud?.url;
	return storageUrl ? parseStorageUrl(storageUrl).domain : null;
};

const addManagedStorage = (pathnameData: PathnameData, storageDomain: string | null): PathnameData =>
	!pathnameData.sourceName && pathnameData.group && pathnameData.repo && storageDomain
		? { ...pathnameData, sourceName: storageDomain }
		: pathnameData;

const resolveCandidate = async (pathnameData: PathnameData, wm: WorkspaceManager): Promise<ResolvedPath> => ({
	pageData: await getPageDataByPathname(pathnameData, wm),
	pathnameData,
});

/**
 * Parses a URL as both the short enterprise form and the legacy full form when they are ambiguous,
 * then returns the variant that matches a catalog in the current workspace.
 */
export const resolvePageDataByPathname = async (
	path: string[] | string | Path,
	wm: WorkspaceManager,
): Promise<ResolvedPath> => {
	const storageDomain = await getManagedStorageDomain(wm);
	const candidates = parsePathCandidates(path).map((candidate) => addManagedStorage(candidate, storageDomain));
	const resolved: ResolvedPath[] = [];
	for (const candidate of candidates) {
		const result = await resolveCandidate(candidate, wm);
		if (result.pageData.type === PageDataType.article) return result;
		resolved.push(result);
	}

	// An unresolved short URL without managed storage belongs to GES, not an external repository.
	if (!storageDomain && candidates.length > 1)
		return { pageData: { type: PageDataType.home }, pathnameData: candidates[0] };

	return resolved.find(({ pageData }) => pageData.type === PageDataType.notFound) ?? resolved[0];
};
