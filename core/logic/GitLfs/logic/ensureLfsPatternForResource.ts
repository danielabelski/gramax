import type Path from "@core/FileProvider/Path/Path";
import {
	type AutoLfsProps,
	LFS_FILTER_ATTR,
	pickLfsPatternFor,
	resolveAutoLfs,
	resolveLfsExclude,
} from "@core/GitLfs/logic/autoLfsAttachments";
import { workspaceLfsPolicy, workspaceSuppressesAutoLfs } from "@core/GitLfs/logic/workspaceManagedLfs";
import type Repository from "@ext/git/core/Repository/Repository";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import { Level, span, traced } from "@ext/loggers/opentelemetry";
import type { Workspace } from "@ext/workspace/Workspace";

/** What the helper needs from a catalog — narrow on purpose, so the int test can stub it. */
export type AutoLfsCatalog = {
	props: { lfs?: AutoLfsProps };
	repo: Repository;
	getRootCategoryPath(): Path;
};

/**
 * Writing `.gitattributes` is read-modify-write and attachment writes are not always sequential —
 * one queue per catalog root keeps concurrent writers from clobbering each other's masks.
 */
const queues = new Map<string, Promise<unknown>>();

const enqueue = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
	const previous = queues.get(key) ?? Promise.resolve();
	const next = previous.then(fn, fn);
	queues.set(
		key,
		next.catch(() => undefined),
	);
	return next;
};

/**
 * Makes sure the attachment about to be written is covered by an LFS mask, adding `*.<ext>` when it
 * is not. Must run BEFORE the file is written: the mask has to be in the index by the time the
 * attachment is staged, or the clean filter never sees it. Returns whether a mask was added.
 *
 * The workspace is consulted here rather than at catalog creation because a catalog that predates
 * its workspace's `git.lfs.patterns` still carries `auto: true` — see `workspaceManagesLfsPatterns`.
 */
export const ensureLfsPatternForResource = (
	workspace: Workspace,
	catalog: AutoLfsCatalog,
	absResourcePath: Path,
): Promise<boolean> =>
	traced("auto-lfs-ensure-pattern", { level: Level.Internal, args: [absResourcePath?.value] }, async () => {
		const lfs = catalog?.props?.lfs;
		const policy = await workspaceLfsPolicy(workspace);
		if (!resolveAutoLfs(policy, lfs)) return false;
		if (await workspaceSuppressesAutoLfs(workspace)) return false;
		if (!(catalog.repo instanceof WorkdirRepository)) return false;

		const rootPath = catalog.getRootCategoryPath();
		const relPath = rootPath.subDirectory(absResourcePath)?.value;
		if (!relPath) return false;

		return enqueue(rootPath.value, async () => {
			const attributes = await catalog.repo.attributes(rootPath);
			const pattern = pickLfsPatternFor({
				auto: true,
				exclude: resolveLfsExclude(undefined, lfs, policy),
				patterns: attributes.findPatternsByAttr(LFS_FILTER_ATTR),
				relPath,
			});
			if (!pattern) return false;

			await attributes.setAttr(pattern, LFS_FILTER_ATTR).save();
			span()?.addEvent("added", { pattern, path: relPath });
			return true;
		});
	});
