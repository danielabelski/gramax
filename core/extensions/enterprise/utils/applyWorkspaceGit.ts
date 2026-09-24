import type { EnterpriseWorkspaceConfig } from "@ext/enterprise/types/UserSettings";
import type { WorkspaceConfig } from "@ext/workspace/WorkspaceConfig";

/**
 * What the local config keeps under `git`: the `WorkspaceConfig` shape plus the repository source,
 * which only the enterprise full config brings and which `WorkspaceConfig` does not declare.
 */
type StoredGit = NonNullable<WorkspaceConfig["git"]> & { source?: EnterpriseWorkspaceConfig["git"]["source"] };

/**
 * The `git` block a refreshed workspace config should keep.
 *
 * Two shapes arrive from the server. The full config — sent only while the client has no hash yet —
 * carries `git` with both the repository source and the LFS block. Every later refresh gets a trimmed
 * one: no `git` at all, and the LFS block at the top level under its deprecated name. Reading only
 * `config.git`, as this used to, meant nothing about LFS ever reached an already-signed-in client —
 * a mask list edited in the admin panel, or the auto-add switched on for the workspace, simply stayed
 * behind until the next sign-in.
 *
 * Merged rather than replaced, so `git.source` survives a refresh that does not mention it. LFS is
 * assigned outright: absent in a fresh config means the workspace no longer states any, and a stale
 * block left behind would go on syncing masks nobody asked for.
 */
const applyWorkspaceGit = (
	current: StoredGit | undefined,
	config: Pick<EnterpriseWorkspaceConfig, "git" | "lfs">,
): StoredGit => {
	const git: StoredGit = { ...current, ...config.git };
	const lfs = config.git?.lfs ?? config.lfs;

	if (lfs) git.lfs = lfs;
	else delete git.lfs;

	return git;
};

export default applyWorkspaceGit;
