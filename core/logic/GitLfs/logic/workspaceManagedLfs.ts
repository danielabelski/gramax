import type { AutoLfsProps } from "@core/GitLfs/logic/autoLfsAttachments";
import {
	configLfsPolicy,
	configManagesLfsPatterns,
	type WorkspaceLfsPolicy,
} from "@core/GitLfs/logic/workspaceLfsPatterns";
import type { Workspace } from "@ext/workspace/Workspace";

/**
 * Whether the workspace owns the LFS masks of its catalogs. Such a workspace syncs every
 * `.gitattributes` to its own `git.lfs.patterns`, so any mask the per-catalog auto-add mints counts
 * as removed on the next sync and is pulled back out.
 */
export const workspaceManagesLfsPatterns = async (workspace: Workspace): Promise<boolean> =>
	configManagesLfsPatterns(await workspace.config());

/** The auto-LFS policy this workspace imposes on its catalogs. Empty where it imposes none. */
export const workspaceLfsPolicy = async (workspace: Workspace): Promise<WorkspaceLfsPolicy> =>
	configLfsPolicy(await workspace.config());

/**
 * Whether the per-catalog auto-add is inert here. It is, under a workspace that syncs its own masks:
 * whatever the auto-add mints is gone on the next sync, and the catalog switch — locked in the UI
 * there — cannot break the loop. Unless that same workspace asked for the auto-add, and then the sync
 * keeps the masks it did not put there (see `workspaceLfsMigration`) and the loop never forms.
 */
export const workspaceSuppressesAutoLfs = async (workspace: Workspace): Promise<boolean> => {
	const config = await workspace.config();
	if (configLfsPolicy(config).auto) return false;
	return configManagesLfsPatterns(config);
};

/**
 * The `lfs` block a catalog is born with. `exclude` holds only what a catalog adds on top of the
 * defaults, and a new one adds nothing — the defaults apply to it all the same.
 */
export const seedAutoLfsProps = async (workspace: Workspace): Promise<AutoLfsProps> => ({
	auto: !(await workspaceSuppressesAutoLfs(workspace)),
	exclude: [],
});
