import type FileProvider from "@core/FileProvider/model/FileProvider";
import Path from "@core/FileProvider/Path/Path";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type ContextualCatalog from "@core/FileStructue/Catalog/ContextualCatalog";
import type GitVersionControl from "@ext/git/core/GitVersionControl/GitVersionControl";
import { GitVersion } from "@ext/git/core/model/GitVersion";
import { getDiff } from "@ext/VersionControl/DiffHandler/DiffHandler";
import assert from "assert";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";

type GitInspectInput = {
	catalogName: string;
	action: "status" | "log" | "diff";
	filePath?: string;
	limit?: number;
	from?: string;
	to?: string;
};

async function status(
	catalogName: string,
	catalog: Catalog | ContextualCatalog,
	gvc: GitVersionControl,
): Promise<ToolExecutionResult> {
	const workdir = await gvc.getChanges("workdir");
	const index = await gvc.getChanges("index");
	const workdirDiff = await gvc.diff({ compare: { type: "workdir" }, renames: true });
	const indexDiff = await gvc.diff({ compare: { type: "index" }, renames: true });

	const statsByPath = new Map<string, { added: number; deleted: number }>();
	for (const file of [...workdirDiff.files, ...indexDiff.files]) {
		const prev = statsByPath.get(file.path.value) ?? { added: 0, deleted: 0 };
		statsByPath.set(file.path.value, {
			added: prev.added + (file.added ?? 0),
			deleted: prev.deleted + (file.deleted ?? 0),
		});
	}

	const seen = new Set<string>();
	const changes = [];
	let added = 0;
	let deleted = 0;
	for (const change of [...workdir, ...index]) {
		if (seen.has(change.path.value)) continue;
		seen.add(change.path.value);
		const stats = statsByPath.get(change.path.value) ?? { added: 0, deleted: 0 };
		added += stats.added;
		deleted += stats.deleted;
		changes.push({
			path: change.path.value,
			absolutePath: catalog.basePath.join(change.path).value,
			status: change.status,
			added: stats.added,
			deleted: stats.deleted,
		});
	}
	return ok({ catalogName, changes, totals: { added, deleted } });
}

async function log(
	catalogName: string,
	gvc: GitVersionControl,
	repoFilePath: Path | null,
	filePath: string | undefined,
	limit: number | undefined,
): Promise<ToolExecutionResult> {
	const depth = limit && limit > 0 ? Math.floor(limit) : 20;
	const { data, reachedFirstCommit } = await gvc.getCommitInfo(
		undefined,
		depth,
		repoFilePath ? { pathspecs: [repoFilePath.value] } : undefined,
	);
	return ok({
		catalogName,
		filePath: filePath ?? null,
		reachedFirstCommit,
		commits: data.map((commit) => ({
			oid: commit.oid,
			summary: commit.summary,
			author: commit.author?.name ?? null,
			timestamp: commit.timestamp,
			parents: commit.parents,
			added: commit.stat?.added ?? 0,
			deleted: commit.stat?.deleted ?? 0,
			files: commit.stat?.changedFiles?.map((file) => file.path) ?? [],
		})),
	});
}

async function diff(
	catalogName: string,
	catalog: Catalog | ContextualCatalog,
	gvc: GitVersionControl,
	fp: FileProvider,
	repoFilePath: Path | null,
	filePath: string | undefined,
	from: string | undefined,
	to: string | undefined,
): Promise<ToolExecutionResult> {
	const fromRef = from?.trim();
	const toRef = to?.trim() || "workdir";
	if (!fromRef && toRef !== "workdir") {
		return fail("diff with to requires from (commit oid)");
	}

	const compare =
		toRef === "workdir"
			? { type: "workdir" as const, tree: fromRef ? new GitVersion(fromRef) : undefined }
			: { type: "tree" as const, old: new GitVersion(fromRef), new: new GitVersion(toRef) };
	const resolvedFrom = compare.type === "workdir" ? (compare.tree?.toString() ?? null) : compare.old.toString();
	const resolvedTo = compare.type === "workdir" ? "workdir" : compare.new.toString();

	const diffResult = await gvc.diff({
		compare,
		renames: true,
		pathspecs: repoFilePath ? [repoFilePath.value] : undefined,
	});

	if (!repoFilePath) {
		return ok({
			catalogName,
			from: resolvedFrom,
			to: resolvedTo,
			hasChanges: diffResult.hasChanges,
			added: diffResult.added,
			deleted: diffResult.deleted,
			files: diffResult.files.map((file) => ({
				path: file.path.value,
				oldPath: file.oldPath?.value ?? null,
				status: file.status,
				added: file.added,
				deleted: file.deleted,
			})),
		});
	}

	const file = diffResult.files.find(
		(entry) => repoFilePath.compare(entry.path) || (entry.oldPath && repoFilePath.compare(entry.oldPath)),
	);
	if (!file) {
		return ok({ catalogName, from: resolvedFrom, to: resolvedTo, filePath, hasChanges: false, file: null });
	}

	const path = file.path;
	const oldPath = file.oldPath ?? path;
	const oldCommit = compare.type === "workdir" ? (compare.tree ?? (await gvc.getHeadCommit())) : compare.old;
	const previousContent = await gvc.showFileContent(oldPath, oldCommit).catch(() => "");
	const currentContent =
		compare.type === "workdir"
			? await fp.read(catalog.basePath.join(path)).catch(() => "")
			: await gvc.showFileContent(path, compare.new).catch(() => "");
	const hunks = getDiff(previousContent, currentContent, { words: false }).changes;

	return ok({
		catalogName,
		from: resolvedFrom,
		to: resolvedTo,
		filePath,
		hasChanges: true,
		file: {
			path: path.value,
			oldPath: file.oldPath?.value ?? null,
			status: file.status,
			added: file.added,
			deleted: file.deleted,
			hunks,
		},
	});
}

export async function runGitInspect({ app, input }: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { action, catalogName, filePath, limit, from, to } = input as GitInspectInput;
	assert(action === "status" || action === "log" || action === "diff", "action must be status | log | diff");

	try {
		const catalog = await app.wm.current().getContextlessCatalog(catalogName);
		if (!catalog?.repo?.gvc) {
			return fail("Git repository not available");
		}
		const gvc = catalog.repo.gvc;
		const repoFilePath = filePath
			? (catalog.basePath.subDirectory(new Path(filePath))?.removeExtraSymbols ?? new Path(filePath))
			: null;

		if (action === "status") return await status(catalogName, catalog, gvc);
		if (action === "log") return await log(catalogName, gvc, repoFilePath, filePath, limit);
		return await diff(
			catalogName,
			catalog,
			gvc,
			app.wm.current().getFileProvider(),
			repoFilePath,
			filePath,
			from,
			to,
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to inspect git: ${msg}`);
	}
}
