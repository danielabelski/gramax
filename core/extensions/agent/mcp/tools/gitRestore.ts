import Path from "@core/FileProvider/Path/Path";
import { GitVersion } from "@ext/git/core/model/GitVersion";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import assert from "assert";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";

type GitRestoreInput = {
	catalogName: string;
	from: string;
	filePaths?: string[];
};

export async function runGitRestore({ app, input }: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { catalogName, from, filePaths } = input as GitRestoreInput;
	const fromRef = from?.trim();
	const hasFilePaths = !!filePaths?.length;

	try {
		assert(fromRef, "from must not be empty");
		const catalog = await app.wm.current().getContextlessCatalog(catalogName);
		if (!catalog?.repo?.gvc) {
			return fail("Git repository not available");
		}
		const gvc = catalog.repo.gvc;
		const fp = app.wm.current().getFileProvider();
		const fromVersion = new GitVersion(fromRef);

		const pathspecs = filePaths?.length
			? filePaths.map(
					(p) => (catalog.basePath.subDirectory(new Path(p))?.removeExtraSymbols ?? new Path(p)).value,
				)
			: undefined;

		const diff = await gvc.diff({
			compare: { type: "workdir", tree: fromVersion },
			renames: true,
			pathspecs,
		});

		const restored: string[] = [];
		const deleted: string[] = [];

		for (const file of diff.files) {
			if (file.status === FileStatus.new) {
				const absPath = catalog.basePath.join(file.path);
				if (await fp.exists(absPath)) {
					await fp.delete(absPath);
					deleted.push(file.path.value);
				}
				continue;
			}

			if (file.status === FileStatus.rename && file.oldPath) {
				const absPath = catalog.basePath.join(file.path);
				if (await fp.exists(absPath)) {
					await fp.delete(absPath);
					deleted.push(file.path.value);
				}
			}

			const path = file.oldPath ?? file.path;
			await fp.write(catalog.basePath.join(path), await gvc.showFileContent(path, fromVersion));
			restored.push(path.value);
		}

		gvc.resetCachedStatus();
		await app.wm.current().refreshCatalog(catalogName);
		return ok(
			{
				catalogName,
				from: fromVersion.toString(),
				restored,
				deleted,
				mode: hasFilePaths ? "paths" : "all",
			},
			{ refreshPage: true },
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to restore from revision: ${msg}`);
	}
}
