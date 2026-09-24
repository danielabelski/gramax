import type { WorkspaceLfsConfig } from "@ext/workspace/WorkspaceConfig";

/**
 * The workspace's LFS block with one part of it changed.
 *
 * A merge rather than a replacement because three separate controls write here — the masks the
 * workspace syncs into every catalog, the switch it imposes on the per-catalog auto-add, and the
 * exclusions it adds to that — and any one of them replacing the block would silently drop the rest.
 */
export const withLfsChange = (
	lfs: WorkspaceLfsConfig | undefined,
	changed: Partial<WorkspaceLfsConfig>,
): WorkspaceLfsConfig => ({ ...lfs, ...changed });
