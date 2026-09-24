import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import { LFS_FILTER_ATTR } from "@core/GitLfs/logic/autoLfsAttachments";
import {
	applyLfsMigration,
	getLfsDivergence,
	getLfsMigrationStats,
	type LfsAffected,
	type LfsDivergence,
} from "@core/GitLfs/logic/lfsMigration";
import { workspaceLfsPolicy } from "@core/GitLfs/logic/workspaceManagedLfs";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import type SourceData from "@ext/storage/logic/SourceDataProvider/model/SourceData";
import type { Workspace } from "@ext/workspace/Workspace";

export type WorkspaceLfsAffected = LfsAffected;
export type WorkspaceLfsDivergence = LfsDivergence;
/** What the workspace-wide sync writes: this migration follows the workspace config, not a catalog setting. */
export const LFS_MIGRATION_COMMIT_MESSAGE = "chore: sync LFS settings from workspace";

/**
 * The masks this sync drives `.gitattributes` to. Normally the workspace list alone, and every other
 * mask counts as removed — that is what makes the workspace the owner.
 *
 * A workspace that also asked for the auto-add cannot work that way: the mask the auto-add mints for
 * a pasted attachment would be gone on the next sync. So the target becomes the union, and since
 * nothing is then missing from it, the sync only ever adds.
 */
const targetPatterns = async (workspace: Workspace, catalog: Catalog): Promise<string[]> => {
	const config = await workspace.config();
	const patterns = config.git?.lfs?.patterns ?? [];
	if (!patterns.length) return patterns;
	if (!(await workspaceLfsPolicy(workspace)).auto) return patterns;
	if (!(catalog.repo instanceof WorkdirRepository)) return patterns;

	const existing = (await catalog.repo.attributes(catalog.getRootCategoryPath())).findPatternsByAttr(LFS_FILTER_ATTR);
	return [...new Set([...patterns, ...existing])];
};

export const getWorkspaceLfsDivergence = async (workspace: Workspace, catalog: Catalog) =>
	getLfsDivergence(workspace, catalog, await targetPatterns(workspace, catalog));

export const getWorkspaceLfsMigrationStats = async (workspace: Workspace, catalog: Catalog) =>
	getLfsMigrationStats(workspace, catalog, await targetPatterns(workspace, catalog));

export const applyWorkspaceLfsMigration = async (workspace: Workspace, catalog: Catalog, data: SourceData) =>
	applyLfsMigration(workspace, catalog, data, await targetPatterns(workspace, catalog), LFS_MIGRATION_COMMIT_MESSAGE);
