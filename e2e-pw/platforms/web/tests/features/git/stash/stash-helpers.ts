import { expect, type Page } from "@playwright/test";
import { evaluateOnApp } from "@utils/app";

/** Mirrors `RepositoryState` — only the parts a test asserts on. */
export type RepoStateSnapshot = {
	value: "default" | "checkout" | "syncing" | "stashConflict" | "mergeConflict";
	stashHash?: string;
	commitHeadBefore?: string;
	conflictPaths?: string[];
};

export type SyncCountSnapshot = { pull: number; push: number; hasChanges: boolean };

/**
 * What the repository thinks it is in the middle of.
 *
 * Read off `.git/gramax/state.json` rather than the in-memory provider: the file is what survives a
 * reload, and the reload path is the one that decides whether a stash comes back.
 */
export const readRepoState = async (page: Page, catalogName: string): Promise<RepoStateSnapshot> => {
	return await evaluateOnApp(
		page,
		async (catalogName: string) => {
			const { wm } = await window.app!;
			const fp = wm.current().getFileProvider();
			const path = window.debug.intoPath(`${catalogName}/.git/gramax/state.json`);

			if (!(await fp.exists(path))) return { value: "default" as const };

			const state = JSON.parse(await fp.read(path));
			return {
				commitHeadBefore: state.data?.commitHeadBefore,
				// `GitMergeResult` carries the conflicting path under `ours`; that is the name the
				// resolve command wants back.
				conflictPaths: (state.data?.conflictFiles ?? []).map(
					(file: { ours?: { path?: string }; path?: string }) => file.ours?.path ?? file.path,
				),
				stashHash: state.data?.stashHash,
				value: state.value,
			};
		},
		catalogName,
	);
};

/**
 * Paths the index holds against HEAD.
 *
 * This is the input `Repository.stash()` decides on: on web it never calls `gvc.add()`, so an empty
 * index here means no stash is taken at all, however dirty the working copy looks.
 */
export const readIndexChanges = async (page: Page, catalogName: string): Promise<string[]> => {
	return await evaluateOnApp(
		page,
		async (catalogName: string) => {
			const { wm } = await window.app!;
			const catalog = await wm.current().getContextlessCatalog(catalogName);
			const changes = await catalog.repo.gvc.getChanges("index");
			return changes.map((change) => change.path.value);
		},
		catalogName,
	);
};

/**
 * Waits for the given file names to show up in the index against HEAD.
 *
 * `Repository.stash()` decides what to stash off this same query, but the write that puts a file
 * there is a fire-and-forget event — a checkout triggered right after `write`/`move`/`delete` (or an
 * editor save) can land before that event has run, and the stash it takes then simply skips the
 * file. Call this after dirtying the working copy and before triggering the checkout that is
 * supposed to stash it.
 */
export const waitForIndexed = async (page: Page, catalogName: string, files: string[]): Promise<void> => {
	await expect
		.poll(async () => {
			const changes = await readIndexChanges(page, catalogName);
			return files.filter((file) => changes.some((change) => change.endsWith(file))).length;
		})
		.toBe(files.length);
};

/** Stash oids Gramax has created for this catalog, newest first — the `WebStashCache` log. */
export const listStashOids = async (page: Page, catalogName: string): Promise<string[]> => {
	return await evaluateOnApp(
		page,
		async (catalogName: string) => {
			const { wm } = await window.app!;
			const repoPath = (await wm.current().getContextlessCatalog(catalogName)).repo.gvc.getPath().value;
			// The cache is keyed by repository path, which is the catalog directory, not its name.
			return (window.debug.gitStashes(repoPath) ?? []).map((item) => item.oid);
		},
		catalogName,
	);
};

/**
 * Stash oids the repository actually holds, newest first.
 *
 * Read out of the `refs/stash` reflog, because that reflog *is* the stash list — `stash_save`
 * appends to it and `stash_drop` rewrites it. Read here rather than through the `stash_list`
 * command on purpose: that command is what the recovery under test uses, and a test that asks the
 * same code the same question cannot catch it being wrong.
 *
 * Reflog lines are `<old-oid> <new-oid> <author> <time>\t<message>`; the new oid is the stash.
 */
export const listRepoStashes = async (page: Page, catalogName: string): Promise<string[]> => {
	return await evaluateOnApp(
		page,
		async (catalogName: string) => {
			const { wm } = await window.app!;
			const fp = wm.current().getFileProvider();
			const path = window.debug.intoPath(`${catalogName}/.git/logs/refs/stash`);

			if (!(await fp.exists(path))) return [];

			return (await fp.read(path))
				.split("\n")
				.filter(Boolean)
				.map((line) => line.split(" ")[1]!)
				.reverse();
		},
		catalogName,
	);
};

export const readSyncCount = async (page: Page, catalogName: string): Promise<SyncCountSnapshot> => {
	return await evaluateOnApp(
		page,
		async (catalogName: string) => {
			const { wm } = await window.app!;
			const catalog = await wm.current().getContextlessCatalog(catalogName);
			const count = await catalog.repo.storage.getSyncCount();
			return { hasChanges: Boolean(count.hasChanges), pull: count.pull, push: count.push };
		},
		catalogName,
	);
};

export const fileExists = async (page: Page, path: string): Promise<boolean> => {
	return await evaluateOnApp(
		page,
		async (path: string) => {
			const { wm } = await window.app!;
			return await wm.current().getFileProvider().exists(window.debug.intoPath(path));
		},
		path,
	);
};

export const readWorkdirFile = async (page: Page, path: string): Promise<string> => {
	return await evaluateOnApp(
		page,
		async (path: string) => {
			const { wm } = await window.app!;
			return await wm.current().getFileProvider().read(window.debug.intoPath(path));
		},
		path,
	);
};

/** Writes a file straight to the working copy, the way a user's editor would. */
export const writeWorkdirFile = async (page: Page, path: string, content: string): Promise<void> => {
	await evaluateOnApp(
		page,
		async ({ path, content }: { path: string; content: string }) => {
			const { wm } = await window.app!;
			const encoder = new TextEncoder();
			await wm
				.current()
				.getFileProvider()
				.write(window.debug.intoPath(path), encoder.encode(content) as unknown as Buffer);
		},
		{ content, path },
	);
};

/**
 * Writes raw bytes, for the cases about binary resources.
 *
 * Playwright serialises the argument, and a `Uint8Array` does not survive that intact — a plain
 * number array does, and is rebuilt on the other side.
 */
export const writeWorkdirBytes = async (page: Page, path: string, bytes: number[]): Promise<void> => {
	await evaluateOnApp(
		page,
		async ({ path, bytes }: { path: string; bytes: number[] }) => {
			const { wm } = await window.app!;
			await wm
				.current()
				.getFileProvider()
				.write(window.debug.intoPath(path), new Uint8Array(bytes) as unknown as Buffer);
		},
		{ bytes, path },
	);
};

export const readWorkdirBytes = async (page: Page, path: string): Promise<number[]> => {
	return await evaluateOnApp(
		page,
		async (path: string) => {
			const { wm } = await window.app!;
			const content = await wm.current().getFileProvider().readAsBinary(window.debug.intoPath(path));
			return Array.from(new Uint8Array(content));
		},
		path,
	);
};

export const deleteWorkdirFile = async (page: Page, path: string): Promise<void> => {
	await evaluateOnApp(
		page,
		async (path: string) => {
			const { wm } = await window.app!;
			await wm.current().getFileProvider().delete(window.debug.intoPath(path));
		},
		path,
	);
};

/** A rename, as git sees it: the delete and the add both reach the index through the move event. */
export const moveWorkdirFile = async (page: Page, from: string, to: string): Promise<void> => {
	await evaluateOnApp(
		page,
		async ({ from, to }: { from: string; to: string }) => {
			const { wm } = await window.app!;
			await wm.current().getFileProvider().move(window.debug.intoPath(from), window.debug.intoPath(to));
		},
		{ from, to },
	);
};

/**
 * Resolves a conflict through the command rather than the resolver dialog.
 *
 * The dialog resolves hunk by hunk inside a code editor, and driving that widget would test the
 * editor, not the stash. What these cases are about lives behind it: whether resolving drops the
 * stash and clears the state.
 */
export const resolveConflict = async (
	page: Page,
	catalogName: string,
	files: { path: string; content: string }[],
): Promise<void> => {
	await evaluateOnApp(
		page,
		async ({ catalogName, files }: { catalogName: string; files: { path: string; content: string }[] }) => {
			const app = await window.app!;
			const ctx = await app.contextFactory.fromWeb({ language: "ru" });
			const commands = await window.debug.commands();
			await commands.versionControl.mergeConflict.resolve.do({ catalogName, ctx, files });
		},
		{ catalogName, files },
	);
};

/**
 * Throws away everything uncommitted, so the next case starts from the branch as published.
 *
 * Cheaper than publishing between cases — a serial block shares one repository, and eight pushes
 * to a real GitLab cost more than the cases themselves.
 */
export const discardAllChanges = async (page: Page, catalogName: string): Promise<void> => {
	await evaluateOnApp(
		page,
		async (catalogName: string) => {
			const { wm } = await window.app!;
			const { gvc } = (await wm.current().getContextlessCatalog(catalogName)).repo;

			const changes = await gvc.getChanges("index");
			const paths = changes.map((change) => change.path);
			if (!paths.length) return;

			await gvc.restore(true, paths);
			await gvc.restore(false, paths);
		},
		catalogName,
	);
};

/** The commit a local branch points at, read straight off its ref file. */
export const readBranchHead = async (page: Page, catalogName: string, branch: string): Promise<string | null> => {
	return await evaluateOnApp(
		page,
		async ({ branch, catalogName }: { branch: string; catalogName: string }) => {
			const { wm } = await window.app!;
			const fp = wm.current().getFileProvider();
			const path = window.debug.intoPath(`${catalogName}/.git/refs/heads/${branch}`);

			if (!(await fp.exists(path))) return null;
			return (await fp.read(path)).trim();
		},
		{ branch, catalogName },
	);
};
