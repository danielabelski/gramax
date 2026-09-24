import assert from "assert";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";

type GitBranchInput = {
	catalogName: string;
	action: "branches" | "checkout";
	branch?: string;
};

export async function runGitBranch({ app, ctx, input }: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { action, catalogName, branch } = input as GitBranchInput;
	assert(action === "branches" || action === "checkout", "action must be branches | checkout");

	try {
		const catalog = await app.wm.current().getContextlessCatalog(catalogName);
		if (!catalog?.repo?.gvc) {
			return fail("Git repository not available");
		}
		const gvc = catalog.repo.gvc;

		if (action === "branches") {
			const current = await gvc.getCurrentBranchName(false);
			const all = await gvc.resetBranches();
			return ok({
				catalogName,
				current,
				branches: all.map((b) => {
					const data = b.getData();
					return { name: data.name, oid: data.lastCommitOid, remote: data.remoteName ?? null };
				}),
			});
		}

		const branchName = branch?.trim();
		assert(branchName, "branch is required for checkout");
		if (!catalog.repo.storage) {
			return fail("Storage is required to checkout branch");
		}

		const sourceData = app.rp.getSourceData(ctx, await catalog.repo.storage.getSourceName());
		const previous = await gvc.getCurrentBranchName(false);
		const conflicts = await catalog.repo.checkout({ data: sourceData, branch: branchName });
		await app.wm.current().refreshCatalog(catalogName);

		return ok(
			{
				catalogName,
				previous,
				current: await gvc.getCurrentBranchName(false),
				conflicts: conflicts.map((file) => ({ path: file.path, status: file.status })),
			},
			{ refreshPage: true },
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to run git_branch: ${msg}`);
	}
}
