import { RustFs } from "@core/FileProvider/DiskFileProvider/DFPIntermediateCommands";
import Path from "@core/FileProvider/Path/Path";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import computeLfsDivergence from "@core/GitLfs/logic/computeLfsDivergence";
import isLfsArticleFile from "@core/GitLfs/logic/isLfsArticleFile";
import isLfsServiceFile from "@core/GitLfs/logic/isLfsServiceFile";
import { isLikelyLfsPointer } from "@core/GitLfs/logic/isLikelyLfsPointer";
import matchGitAttributesPattern from "@core/GitLfs/logic/matchGitAttributesPattern";
import DefaultError from "@ext/errorHandlers/logic/DefaultError";
import type GitSourceData from "@ext/git/core/model/GitSourceData.schema";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import { span } from "@ext/loggers/opentelemetry";
import type SourceData from "@ext/storage/logic/SourceDataProvider/model/SourceData";
import type { Workspace } from "@ext/workspace/Workspace";

// How much the migration commit will actually carry — the tracked files the changed patterns
// match. Shown in the dialog as a headline count and total size, so the user knows the scale.
export type LfsAffected = {
	fileCount: number;
	totalSize: number;
};

export type LfsDivergence = {
	added: string[];
	removed: string[];
	legacyStaged: boolean;
	fileDiff?: { before: string; after: string };
};

const NONE: LfsDivergence = {
	added: [],
	removed: [],
	legacyStaged: false,
};

const gitattributesRelPath = (catalog: Catalog) =>
	catalog.getRelativeRootCategoryPath().join(new Path(".gitattributes"));

export async function getLfsDivergence(
	_workspace: Workspace,
	catalog: Catalog,
	targetPatterns: string[],
): Promise<LfsDivergence> {
	if (!targetPatterns?.length) return NONE;
	if (!(catalog.repo instanceof WorkdirRepository)) return NONE;

	const attributes = await catalog.repo.attributes(catalog.getRootCategoryPath());
	const { added, removed } = computeLfsDivergence(targetPatterns, attributes.findPatternsByAttr("filter=lfs"));

	if (added.length || removed.length) {
		// Preview only: `setAttrMany` mutates this local instance, `save` is never called on it.
		const before = attributes.serialize();
		const after = attributes.setAttrMany(targetPatterns, "filter=lfs").serialize();
		return { added, removed, legacyStaged: false, fileDiff: { before, after } };
	}

	const rel = gitattributesRelPath(catalog);
	const indexChanges = await catalog.repo.gvc.getChanges("index");
	const legacyStaged = indexChanges.some((c) => c.path.value === rel.value);

	return { added, removed, legacyStaged };
}

// A file affected by the migration: `repoPath` is relative to the repo root, as `filesToPublish`
// expects; `rootPath` is relative to the catalog root — the form `.gitattributes` patterns match;
// `size` is the committed blob size (LFS pointers resolve to their real size), summed for the dialog.
type AffectedLfsFile = { repoPath: Path; rootPath: string; size: number };

/** A mask reaching a catalog's own prose or its service files is never obeyed, however it got there. */
const isMigratable = (rootRelPath: string, patterns: string[]): boolean => {
	if (isLfsServiceFile(rootRelPath)) return false;
	if (isLfsArticleFile(rootRelPath)) return false;
	return patterns.some((pattern) => matchGitAttributesPattern(pattern, rootRelPath));
};

// Recursively walks the committed (HEAD) tree of the catalog looking for files whose path (relative
// to the catalog root) matches one of `patterns`, skipping the catalog's service files and its
// articles.
//
// Reading the tree instead of the workdir is what keeps the user's own work out of the service
// commit: an untracked or edited file is not what HEAD holds, and committing it would publish
// something they did not choose to publish. Nothing is lost by leaving it — the mask lands in the
// index with this commit, so their next publish sends the file to LFS by itself.
async function listAffectedLfsFilesForPatterns(
	workspace: Workspace,
	catalog: Catalog,
	patterns: string[],
): Promise<AffectedLfsFile[]> {
	if (!patterns.length) return [];

	const repo = catalog.repo as WorkdirRepository;
	// A just `git init`-ed repo (storage/init) has no HEAD tree to read — nothing is tracked yet.
	const hasHeadCommit = await repo.gvc.getHeadCommit().then(
		() => true,
		() => false,
	);
	if (!hasHeadCommit) return [];

	const relRoot = catalog.getRelativeRootCategoryPath();
	const repoAbsPath = workspace.getFileProvider().rootPath.join(repo.gvc.getPath()).value;
	const tree = RustFs.git(repoAbsPath, "HEAD");
	const pending = await repo.gvc.getChanges("workdir");
	const pendingPaths = new Set(pending.map((change) => change.path.value));
	const affected: AffectedLfsFile[] = [];

	const walk = async (relToRootDir: Path): Promise<void> => {
		const items = await tree.readDirStats(relRoot.join(relToRootDir).value);
		for (const item of items) {
			const relToRoot = relToRootDir.join(new Path(item.name));
			if (item.isDirectory()) {
				await walk(relToRoot);
				continue;
			}
			if (!item.isFile()) continue;
			if (!isMigratable(relToRoot.value, patterns)) continue;

			const relToRepo = relRoot.join(relToRoot);
			// The commit stages the working copy, so a file the user has touched would go in with their
			// edit — theirs to publish, not ours. A deletion is skipped for the mirror reason: the file
			// is in HEAD only because the removal is what is pending, and staging it would put it back.
			if (pendingPaths.has(relToRepo.value)) continue;

			affected.push({ repoPath: relToRepo, rootPath: relToRoot.value, size: item.size });
		}
	};

	await walk(Path.empty);
	return affected;
}

// Scale of the pending migration for the dialog: the tracked files the changed patterns match,
// i.e. exactly what `applyLfsMigration` will put into the service commit. Walks the HEAD
// tree, so it is fetched lazily by the dialog instead of riding along with the divergence check.
export async function getLfsMigrationStats(
	workspace: Workspace,
	catalog: Catalog,
	targetPatterns: string[],
): Promise<LfsAffected> {
	const divergence = await getLfsDivergence(workspace, catalog, targetPatterns);
	const patterns = [...divergence.added, ...divergence.removed];
	if (!patterns.length) return { fileCount: 0, totalSize: 0 };

	const affected = await listAffectedLfsFilesForPatterns(workspace, catalog, patterns);
	return {
		fileCount: affected.length,
		totalSize: affected.reduce((sum, f) => sum + f.size, 0),
	};
}

// A file whose mask was removed must come back to git as a plain blob with its real content:
// once `filter=lfs` is gone from `.gitattributes`, nothing resolves its pointer anymore — in any
// client. But with lazy LFS the working copy holds the pointer text itself, so re-adding the file
// would just commit the 130-byte pointer as plain content and lose the data. This materializes
// the real content into the working copy first, and — crucially — verifies every file BEFORE
// writing anything: if even one LFS object cannot be obtained, the whole migration aborts with
// the working copy, `.gitattributes` and the patterns untouched, so no state is half-migrated.
async function materializeFilesLeavingLfs(
	workspace: Workspace,
	catalog: Catalog,
	data: SourceData,
	leavingLfs: Path[],
): Promise<void> {
	if (!leavingLfs.length) return;

	const repo = catalog.repo as WorkdirRepository;
	const repoAbsPath = workspace.getFileProvider().rootPath.join(repo.gvc.getPath()).value;
	const disk = RustFs.disk(repoAbsPath);

	// Only files whose working copy is a pointer need materializing; a non-lazy checkout already
	// holds the real bytes and the plain re-add stages them as-is.
	const dangling: Path[] = [];
	for (const file of leavingLfs) {
		if (isLikelyLfsPointer(await disk.readFile(file.value))) dangling.push(file);
	}
	if (!dangling.length) return;

	// Fetch the missing objects into `.git/lfs/objects`. `checkout: false` on purpose: the Rust
	// checkout deletes the working file and restores it from HEAD — which is the pointer blob.
	await repo.gvc.pullLfsObjects(data as GitSourceData, dangling, false);

	// Reading through the HEAD tree resolves the pointer against the local LFS store; when the
	// object is still absent (pull found nothing to fetch or the server doesn't have it), the
	// read falls back to the pointer text itself — that is the abort signal.
	const head = RustFs.git(repoAbsPath, "HEAD");
	const materialized: { path: string; content: Buffer }[] = [];
	for (const file of dangling) {
		const content = await head.readFile(file.value);
		if (isLikelyLfsPointer(content)) {
			throw new DefaultError(
				`LFS migration aborted: the LFS object for "${file.value}" is not available locally and could not be fetched. ` +
					`Removing its pattern now would replace the file content with a raw LFS pointer.`,
			);
		}
		materialized.push({ path: file.value, content });
	}

	for (const { path, content } of materialized) await disk.writeFile(path, content);
}

export type LfsMigrationOptions = {
	/**
	 * Repo-relative files to carry inside the service commit next to `.gitattributes`. The engine never
	 * picks them: it serves both the workspace-wide sync and a single catalog's attachments, and the
	 * setting that caused a migration is the caller's — the workspace sync has no catalog props to commit.
	 * They ride along only when a migration actually runs; nothing here can turn an empty run into a commit.
	 */
	extraFiles?: Path[];
	/**
	 * Called the moment a batch lands as a commit. The unwind below runs only while nothing was
	 * committed, so a caller layering its own state on the migration needs to know the repo stayed migrated.
	 */
	onCommitted?: () => void;
};

export async function applyLfsMigration(
	workspace: Workspace,
	catalog: Catalog,
	data: SourceData,
	targetPatterns: string[],
	// Owned by the caller: the engine serves both the workspace-wide sync and a single catalog's
	// attachments, and only the caller knows which sentence is true for the user who triggered it.
	commitMessage: string,
	{ extraFiles = [], onCommitted }: LfsMigrationOptions = {},
): Promise<void> {
	const divergence = await getLfsDivergence(workspace, catalog, targetPatterns);
	if (!divergence.added.length && !divergence.removed.length && !divergence.legacyStaged) return;

	const patterns = targetPatterns;
	const repo = catalog.repo as WorkdirRepository;
	const rel = gitattributesRelPath(catalog);

	// Pick the files before touching `.gitattributes`: once the new patterns are on disk, git sees
	// every matching tracked file as modified (index holds the raw blob, the workdir one now runs
	// through the LFS filter), and they would all be dropped as "locally modified".
	const affected = await listAffectedLfsFilesForPatterns(workspace, catalog, [
		...divergence.added,
		...divergence.removed,
	]);
	const affectedFiles = affected.map((f) => f.repoPath);

	// Files leaving LFS entirely: matched by a removed mask and by none of the surviving ones. Their
	// real content must be on disk before `.gitattributes` changes — see materializeFilesLeavingLfs.
	// Files that only match added masks never reach this: no LFS download on the add direction.
	const leavingLfs = affected
		.filter(
			(f) =>
				divergence.removed.some((p) => matchGitAttributesPattern(p, f.rootPath)) &&
				!patterns.some((p) => matchGitAttributesPattern(p, f.rootPath)),
		)
		.map((f) => f.repoPath);
	await materializeFilesLeavingLfs(workspace, catalog, data, leavingLfs);

	const attributes = await repo.attributes(catalog.getRootCategoryPath());
	await attributes.setAttrMany(patterns, "filter=lfs").save();

	// How the migration is committed depends on direction. Adding a mask turns plain files into
	// pointers via the clean filter, so `.gitattributes` and those files fit in one commit. Removing
	// a mask must bring a file back as a plain blob — but the isolated commit resets the index to
	// HEAD before staging, and with the old `.gitattributes` still there the clean filter re-cleans
	// the file into the very pointer we are dropping (git evaluates the filter against the tree's
	// `.gitattributes`, not the working copy). So when anything is removed, commit `.gitattributes`
	// on its own first: once the new rules are in HEAD, the next commit stages the file content
	// against them and stores the real bytes.
	// The caller's files join `.gitattributes`: whatever made the masks change belongs in the same
	// commit as the masks, so a clone that pulls one cannot end up without the other.
	const serviceFiles = [rel, ...extraFiles];
	const commitBatches: Path[][] = divergence.removed.length
		? affectedFiles.length
			? [serviceFiles, affectedFiles]
			: [serviceFiles]
		: [[...serviceFiles, ...affectedFiles]];

	let committed = false;
	const markCommitted = () => {
		committed = true;
		onCommitted?.();
	};
	try {
		// Every batch but the last commits locally; the last commits and pushes, so the migration
		// reaches the remote as a single push regardless of how many commits it took.
		for (let i = 0; i < commitBatches.length; i++) {
			const batch = commitBatches[i];

			// Pre-stage exactly our own files before each commit. `commit(..., batch)` resets the
			// index to HEAD, adds `batch`, and — when the pre-existing staged-file count doesn't match
			// `batch.length` — restores whatever was staged before by re-adding it with an (possibly
			// empty) pathspec; libgit2 treats an EMPTY pathspec as "add everything", sweeping unrelated
			// dirty workdir files (e.g. an in-progress article edit) into the commit. Staging our files
			// first makes the counts match, skipping that restore — see
			// crates/git/src/actions/commit.rs `index_create_tree`.
			await repo.gvc.add(batch);

			if (i < commitBatches.length - 1) {
				await repo.gvc.commit(commitMessage, data, null, batch);
				markCommitted();
				continue;
			}

			await repo.publish({
				commitMessage,
				filesToPublish: batch,
				data,
				onCommit: () => {
					markCommitted();
				},
				restoreIfFail: false,
			});
		}
		span()?.addEvent("apply", {
			added: divergence.added,
			removed: divergence.removed,
			affectedFiles: affectedFiles.length,
		});
	} catch (e) {
		if (!committed) {
			// Nothing was committed yet. `.gitattributes` was written by us — fully revert (unstage +
			// workdir content). Affected files were not modified by us, so only unstage them, never
			// touching workdir content, so any pre-existing uncommitted user changes survive. The one
			// exception is materialized leaving-LFS files: their working copy now holds real content
			// instead of the pointer text, and that is left in place on purpose — with the old mask
			// restored the clean filter maps it back to the same pointer, so the file still reads
			// correctly and git status stays clean.
			// The caller's extra files are unstaged alongside the affected ones and never discarded: their
			// content is the caller's to roll back, and a discard would also wipe unrelated edits to them.
			const ourStaged = [...extraFiles, ...affectedFiles];
			await repo.gvc.discard([rel]);
			if (ourStaged.length) await repo.gvc.restore(true, ourStaged);
		}
		throw e;
	}
}
