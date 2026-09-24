import type { WorkspaceConfig } from "@ext/workspace/WorkspaceConfig";

/** What a config has to carry for the questions below — the whole `WorkspaceConfig` is more than either needs. */
type LfsRelevantConfig = Pick<WorkspaceConfig, "git" | "enterprise" | "enterpriseCloud">;

/**
 * Whether a workspace config owns the LFS masks of its catalogs. Asked on both sides — the backend
 * through `workspaceManagesLfsPatterns`, the catalog settings form off `Workspace.current()` — and the
 * two must never answer differently, so the question lives here once. This module carries a single type
 * import on purpose: a value import would drag its graph into the browser bundle behind the form.
 */
export const configManagesLfsPatterns = (config: Pick<WorkspaceConfig, "git"> | undefined): boolean =>
	!!config?.git?.lfs?.patterns?.length;

/**
 * The auto-LFS policy a workspace imposes on its catalogs. Absent keys mean it imposes nothing.
 *
 * `auto` is `true` or absent, never `false`: a workspace can turn the auto-add on for every catalog
 * under it, but leaving it off is not a prohibition — it is simply saying nothing, and each catalog
 * goes on answering for itself. The type says so, so nothing downstream has to remember it.
 */
export type WorkspaceLfsPolicy = {
	auto?: true;
	exclude?: string[];
};

const NO_POLICY: WorkspaceLfsPolicy = {};

/**
 * The policy this workspace imposes, and only where there is an administrator to impose it: a
 * GES or cloud workspace is configured centrally, while a plain one is the user's own and answers
 * nothing here however its yaml is hand-edited.
 */
export const configLfsPolicy = (config: LfsRelevantConfig | undefined): WorkspaceLfsPolicy => {
	const administered = !!config?.enterprise?.gesUrl || !!config?.enterpriseCloud?.url;
	if (!administered) return NO_POLICY;
	const { auto, exclude } = config?.git?.lfs ?? {};
	if (!auto && exclude === undefined) return NO_POLICY;
	return auto ? { auto: true, exclude } : { exclude };
};
