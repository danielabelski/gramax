import { DOC_ROOT_FILENAMES } from "@app/config/const";
import type MountFileProvider from "@core/FileProvider/MountFileProvider/MountFileProvider";
import Path from "@core/FileProvider/Path/Path";
import { FS_EXCLUDE_FILENAMES } from "@core/FileStructue/backend/scanExcludes";

type DocrootFileProvider = Pick<MountFileProvider, "readdir" | "getStat">;

type QueuedDir = { path: Path; depth: number };

export const DOCROOT_SEARCH_DEPTH = 5;

/**
 * Breadth-first search for a catalog's doc-root, mirroring `find_docroot` in
 * `crates/core/src/scan/utils.rs` decision for decision — the two backends have to agree on which
 * file makes a directory a catalog, and on where the catalog's root then sits.
 *
 * That means: exact names from `DOC_ROOT_FILENAMES` in their declared order (never a pattern — a
 * loose one would also match `my-root.yaml`, which the Rust scan ignores), names sorted so a tie is
 * broken the same way on both sides, and no descent into hidden or excluded directories.
 *
 * It runs over the mount provider rather than a backend because a bare repository has no working
 * copy on disk — the doc-root only exists in the git tree the provider mounts.
 */
const findDocroot = async (
	fp: DocrootFileProvider,
	root: Path,
	excludeDirs: readonly string[] = FS_EXCLUDE_FILENAMES,
	depth = DOCROOT_SEARCH_DEPTH,
): Promise<Path | undefined> => {
	const queue: QueuedDir[] = [{ path: root, depth: 0 }];
	const explored = new Set<string>();

	while (queue.length) {
		const dir = queue.shift();
		if (explored.has(dir.path.value)) continue;
		explored.add(dir.path.value);

		const entries = await fp.readdir(dir.path).catch(() => []);
		if (!entries?.length) continue;

		const docroot = DOC_ROOT_FILENAMES.find((name) => entries.includes(name));
		if (docroot) return dir.path.join(new Path(docroot));

		if (dir.depth + 1 >= depth) continue;

		const names = entries.filter((name) => !isExcludedDir(name, excludeDirs)).sort(ordinal);
		for (const name of names) {
			const path = dir.path.join(new Path(name));
			if (explored.has(path.value)) continue;

			const stat = await fp.getStat(path).catch(() => undefined);
			if (stat?.isDirectory()) queue.push({ path, depth: dir.depth + 1 });
		}
	}
};

/** Hidden directories never hold a catalog; the rest come from the scan's exclusion list. */
const isExcludedDir = (name: string, excludeDirs: readonly string[]): boolean =>
	name.startsWith(".") || excludeDirs.includes(name);

const ordinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export default findDocroot;
