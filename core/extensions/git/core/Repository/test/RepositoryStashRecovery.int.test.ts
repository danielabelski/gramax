/**
 * @jest-environment node
 */

/**
 * What happens to a local change that is sitting in a stash when the operation carrying it fails.
 *
 * Between `Repository.stash` and `applyStash` the user's edit exists in exactly one place: a commit
 * hanging off `refs/stash`. The working copy has already been reset to `HEAD` — that is what taking
 * a stash means. Everything between those two calls is a window where the edit is invisible, and
 * whether it comes back depends on someone remembering the stash.
 *
 * A sync remembers: `_pull` writes `{value: "syncing", stashHash}` before pulling, and reopening the
 * repository replays it (`_restoreStashAfterInterruptedSync`). A checkout does not: the state it
 * writes is `{value: "checkout", data: {to}}`, which names the branch and not the stash, and the
 * next `getState` throws that state away without looking for one.
 *
 * These tests are RED on purpose — each one is a way a user loses an unpublished change today.
 */

import { execSync } from "node:child_process";
import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import Path from "@core/FileProvider/Path/Path";
import GitStorage from "@ext/git/core/GitStorage/GitStorage";
import GitVersionControl from "@ext/git/core/GitVersionControl/GitVersionControl";
import RepositoryProvider from "@ext/git/core/Repository/RepositoryProvider";
import FileRepository from "@ext/git/core/Repository/test/utils/FileRepository";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import fs from "fs";

const data = FileRepository.sourceData;

/** The unpublished edit every test here is about losing. */
const EDIT = "written by hand, never published";

let fr: FileRepository;
let rep: WorkdirRepository;

const editedFile = () => `${fr.firstPath}/init`;
const readEdited = () => fs.readFileSync(editedFile(), "utf-8");

/**
 * The same repository as a new session sees it — a fresh instance over the same folder.
 *
 * Nothing in-memory survives a page reload, so a reload is exactly this: the state file and the
 * `refs/stash` reflog on disk, read by an object that has never seen the operation that failed.
 */
const reopen = (): WorkdirRepository => {
	const dfp = new DiskFileProvider(new Path(__dirname));
	const path = new Path("FILE_WORKDIR1");
	const gvc = new GitVersionControl(path, dfp);
	return new WorkdirRepository(path, dfp, gvc, new GitStorage(path, dfp));
};

/** Leaves the repository on a branch of its own with one unpublished edit in the working copy. */
const withAnUnpublishedEdit = async () => {
	await rep.gvc.createNewBranch("local");
	fs.writeFileSync(editedFile(), EDIT);
};

describe("a stash taken by an operation that then fails", () => {
	beforeEach(() => {
		fr = new FileRepository(__dirname);
		({ firstInstance: rep } = fr.create());
	});

	afterEach(async () => {
		await RepositoryProvider.resetRepo();
		fr.clear();
		fr = null;
		jest.restoreAllMocks();
	});

	/**
	 * The checkout itself throws — the branch cannot be written, the fetch behind it fails, anything.
	 * The stash is already taken by then, so the working copy is back at `HEAD` and the edit is only
	 * in the stash commit. Nothing catches this, so nothing puts it back.
	 */
	test("a checkout that fails after taking the stash keeps the local edit", async () => {
		await withAnUnpublishedEdit();

		jest.spyOn(GitVersionControl.prototype, "checkoutToBranch").mockRejectedValueOnce(new Error("checkout failed"));

		await expect(rep.checkout({ data, branch: "master" })).rejects.toThrow("checkout failed");

		expect(readEdited()).toBe(EDIT);
	});

	/**
	 * The branch switch works and the first replay does not — the refusal a stash gives when something
	 * is standing where it has to write. That is not the end of the checkout: replayed against the
	 * index the stash lands, and the user's change is back where they left it.
	 */
	test("a checkout whose first replay is refused still delivers the local edit", async () => {
		await withAnUnpublishedEdit();

		jest.spyOn(GitVersionControl.prototype, "applyStash").mockRejectedValueOnce(new Error("apply failed"));

		await rep.checkout({ data, branch: "master" });

		expect(readEdited()).toBe(EDIT);
		expect(await rep.gvc.listStashes()).toHaveLength(0);
	});

	/**
	 * The ledger is `refs/stash`, not the state file — so when even putting the stash back fails, the
	 * commit is still there and the next session can try again. Nothing is deleted that has not landed.
	 */
	test("a stash that could not be put back is still in refs/stash", async () => {
		await withAnUnpublishedEdit();

		jest.spyOn(GitVersionControl.prototype, "checkoutToBranch").mockRejectedValueOnce(new Error("checkout failed"));
		jest.spyOn(GitVersionControl.prototype, "applyStash").mockRejectedValue(new Error("apply failed"));

		await expect(rep.checkout({ data, branch: "master" })).rejects.toThrow("checkout failed");

		const stashes = await rep.gvc.listStashes();
		expect(stashes.filter((stash) => !stash.isForeign)).toHaveLength(1);
	});

	/**
	 * A reload in the middle of a checkout — the tab is closed, the app is restarted, the page reloads
	 * on its own. The next session reads the state file, sees `checkout`, and calls `resetState`: the
	 * marker is dropped and the stash it belonged to is never mentioned again. The commit stays in
	 * `refs/stash` where no interface leads, and to the user the change is gone.
	 */
	test("a new session after an interrupted checkout puts the stashed edit back", async () => {
		await withAnUnpublishedEdit();

		jest.spyOn(GitVersionControl.prototype, "checkoutToBranch").mockRejectedValueOnce(new Error("checkout failed"));
		await expect(rep.checkout({ data, branch: "master" })).rejects.toThrow("checkout failed");

		const reopened = reopen();
		await reopened.getState();

		expect(readEdited()).toBe(EDIT);
	});

	/**
	 * The case people actually hit: they keep typing while the branch is switching.
	 *
	 * The stash was taken at the start of the checkout, so the working copy is empty and every
	 * keystroke lands in a file the stash is going to write back — and in the index behind it. Against
	 * `HEAD` that text does not exist, so the replay is refused and the checkout used to end with the
	 * stash undelivered. Against the index it is one side of a merge, and both texts end up in the file
	 * for the user to settle.
	 */
	test("text typed while the branch was switching meets the stash as a conflict", async () => {
		await withAnUnpublishedEdit();

		const typed = "typed while the branch was switching";
		const switchBranch = GitVersionControl.prototype.checkoutToBranch;
		jest.spyOn(GitVersionControl.prototype, "checkoutToBranch").mockImplementation(async function (
			this: GitVersionControl,
			...args: Parameters<typeof switchBranch>
		) {
			const result = await switchBranch.apply(this, args);
			fs.writeFileSync(editedFile(), typed);
			return result;
		});

		await rep.checkout({ data, branch: "master" });

		expect((await rep.getState()).inner.value).toBe("stashConflict");

		const content = readEdited();
		expect(content).toContain(typed);
		expect(content).toContain(EDIT);
	});

	/**
	 * Abandoning a conflict born of the replay gives the user back what they wrote after the restart.
	 *
	 * Aborting a stash conflict is `reset --hard` and a replay, and a reset takes the working copy with
	 * it. So the work done since the restart is put aside as a stash of its own before anything is
	 * replayed, and it is that stash the abort puts back. What the interrupted operation had stashed
	 * stays in `refs/stash`, to be offered again the next time the catalog is opened.
	 */
	test("abandoning the replay gives back the work done after the restart", async () => {
		await withAnUnpublishedEdit();

		jest.spyOn(GitVersionControl.prototype, "checkoutToBranch").mockRejectedValueOnce(new Error("checkout failed"));
		jest.spyOn(GitVersionControl.prototype, "applyStash").mockRejectedValueOnce(new Error("apply failed"));

		await expect(rep.checkout({ data, branch: "master" })).rejects.toThrow("checkout failed");

		const written = "written after the restart";
		const reopened = reopen();
		fs.writeFileSync(editedFile(), written);
		await reopened.gvc.add();

		const state = await reopened.getState();
		expect(state.inner.value).toBe("stashConflict");

		await state.abortMerge(data);

		expect(readEdited()).toBe(written);
		expect((await reopened.gvc.listStashes()).filter((stash) => !stash.isForeign)).toHaveLength(1);
	});

	/**
	 * A replay that cannot go on must not leave the working copy emptier than it found it.
	 *
	 * The user's own work is put aside first so that what is being replayed lands on a clean copy. If
	 * the replay then fails, that reason is gone — and leaving their text in `refs/stash` is the exact
	 * disappearance this is here to prevent: they open the catalog and find it missing, with the only
	 * copy in a reflog no interface shows.
	 */
	test("a replay that fails gives the user their own work back", async () => {
		await withAnUnpublishedEdit();

		// One rejection for the checkout's own attempt to put the stash back, so it stays pending; one
		// for the replay on the next open. The third call — the one that returns the user's own work —
		// runs for real, which is the whole point.
		jest.spyOn(GitVersionControl.prototype, "checkoutToBranch").mockRejectedValueOnce(new Error("checkout failed"));
		jest.spyOn(GitVersionControl.prototype, "applyStash")
			.mockRejectedValueOnce(new Error("apply failed"))
			.mockRejectedValueOnce(new Error("apply failed"));

		await expect(rep.checkout({ data, branch: "master" })).rejects.toThrow("checkout failed");

		const written = "written after the restart, and not to be taken away";
		const reopened = reopen();
		fs.writeFileSync(editedFile(), written);
		await reopened.gvc.add();

		await reopened.getState();

		expect(readEdited()).toBe(written);
		// The stash that could not be replayed is still there for the next attempt.
		expect((await reopened.gvc.listStashes()).filter((stash) => !stash.isForeign)).toHaveLength(1);
	});

	/**
	 * A stash a person made themselves is theirs. Replaying it would put content into their working
	 * copy that they chose to set aside, which is the same surprise as losing it — in the other
	 * direction.
	 */
	test("a stash made by hand is left where its owner put it", async () => {
		fs.writeFileSync(editedFile(), "put aside by hand");
		execSync("git stash", { cwd: fr.firstPath, stdio: "pipe" });

		expect(readEdited()).toBe("init");

		const reopened = reopen();
		await reopened.getState();

		expect(readEdited()).toBe("init");
		expect(await reopened.gvc.listStashes()).toHaveLength(1);
	});

	/**
	 * A sync whose replay fails leaves the stash standing, and opening the catalog again does not fail
	 * over it either. Both attempts end with the commit still in `refs/stash`, which is what makes a
	 * third attempt — or a hand at a terminal — possible at all.
	 */
	test("a sync whose stash cannot be replayed leaves it for the next session", async () => {
		fs.writeFileSync(editedFile(), EDIT);

		jest.spyOn(GitVersionControl.prototype, "applyStash").mockRejectedValue(new Error("apply failed"));

		await expect(rep.sync({ data })).rejects.toThrow("apply failed");

		const reopened = reopen();
		await reopened.getState();

		const stashes = await reopened.gvc.listStashes();
		expect(stashes.filter((stash) => !stash.isForeign)).toHaveLength(1);
	});

	/**
	 * The user opened the catalog and wrote again before anything was put back. Their text is in the
	 * index, the stash is in `refs/stash`, and both belong in the file — so the replay hands over a
	 * conflict rather than choosing for them.
	 */
	test("a replay over work done after the restart comes back as a conflict", async () => {
		await withAnUnpublishedEdit();

		jest.spyOn(GitVersionControl.prototype, "checkoutToBranch").mockRejectedValueOnce(new Error("checkout failed"));
		jest.spyOn(GitVersionControl.prototype, "applyStash").mockRejectedValueOnce(new Error("apply failed"));

		await expect(rep.checkout({ data, branch: "master" })).rejects.toThrow("checkout failed");

		const written = "written after the restart, before anything was put back";
		fs.writeFileSync(editedFile(), written);

		const reopened = reopen();
		await reopened.gvc.add();
		const state = await reopened.getState();

		expect(state.inner.value).toBe("stashConflict");

		const content = readEdited();
		expect(content).toContain(written);
		expect(content).toContain(EDIT);
	});
});
