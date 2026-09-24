import { expect } from "@playwright/test";
import { commitToRemote, type GitlabProject } from "@utils/gitlab";
import { attachTimings, measure } from "@utils/timings";
import { gitTest as test } from "@web/fixtures/git.fixture";
import type CatalogPage from "@web/pom/catalog.page";
import { remoteCatalogUrl } from "../catalog-setup";
import {
	listRepoStashes,
	readRepoState,
	readSyncCount,
	readWorkdirFile,
	resolveConflict,
	writeWorkdirFile,
} from "./stash-helpers";
import { prepareStashCatalog } from "./stash-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const ARTICLE = "test.md";

let catalogName: string;
let project: GitlabProject;

const path = () => `${catalogName}/${ARTICLE}`;
const article = (body: string) => `---\ntitle: Test\n---\n\n${body}\n`;

/**
 * Sets both sides editing the same line and syncs, which is what makes the stash apply conflict.
 *
 * The local edit is never published, so it lives in the stash the pull takes; the remote edit lands
 * on the same line of the same file, so replaying the stash on top cannot merge cleanly.
 */
const raiseConflict = async (catalogPage: CatalogPage, page: Parameters<typeof writeWorkdirFile>[0], tag: string) => {
	await catalogPage.goto(remoteCatalogUrl(catalogName));
	await catalogPage.waitForLoad();

	await writeWorkdirFile(page, path(), article(`Local edit ${tag}`));
	await commitToRemote(
		project.id,
		[{ action: "update", content: article(`Remote edit ${tag}`), filePath: ARTICLE }],
		`e2e: conflicting remote edit ${tag}`,
	);

	await catalogPage.git().sync();
	await expect(catalogPage.git().syncConflictAlert).toBeVisible({ timeout: 120_000 });
};

test.describe("a stash that cannot be replayed becomes a conflict", () => {
	test("links a fresh catalog and finds the repository behind it", async ({
		catalogPage,
		sharedPage,
		tempRepoName,
	}) => {
		catalogName = tempRepoName;
		project = await prepareStashCatalog(catalogPage, sharedPage, { name: catalogName });

		await catalogPage.git().assertCurrentBranch("master");
	});

	test("overlapping edits leave the repository in a stash conflict", async ({
		catalogPage,
		sharedPage,
	}, testInfo) => {
		await measure(testInfo, "sync-conflict", () => raiseConflict(catalogPage, sharedPage, "sy-04"));

		await expect(catalogPage.git().syncConflictAlert).toBeVisible({ timeout: 120_000 });

		const state = await readRepoState(sharedPage, catalogName);
		expect(state.value).toBe("stashConflict");
		expect(state.stashHash).toBeTruthy();
		expect(state.commitHeadBefore).toBeTruthy();
		expect(state.conflictPaths).toContainEqual(expect.stringContaining("test.md"));

		// Applying with `deleteAfterApply: false` is the point: the stash has to outlive the failed
		// apply, or aborting would have nothing to put back.
		expect(await listRepoStashes(sharedPage, catalogName)).toContain(state.stashHash);

		await attachTimings(testInfo);
	});

	test("resolving the conflict drops the stash and clears the state", async ({ catalogPage, sharedPage }) => {
		const resolved = article("Resolved by hand, keeping neither side whole");

		const before = await readRepoState(sharedPage, catalogName);
		await resolveConflict(sharedPage, catalogName, [{ content: resolved, path: before.conflictPaths![0]! }]);

		expect(await readWorkdirFile(sharedPage, path())).toBe(resolved);
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");
		expect(await listRepoStashes(sharedPage, catalogName)).not.toContain(before.stashHash);

		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();
	});

	test("aborting the conflict rewinds to before the pull and puts the local edit back", async ({
		catalogPage,
		sharedPage,
	}) => {
		// The resolved content from the previous case is still uncommitted, which is fine: it is one
		// more local change for this stash to carry. Publishing it first is not possible anyway —
		// resolving through the command leaves the publish panel out of step until a reload, and
		// `raiseConflict` reloads on its way in.
		await raiseConflict(catalogPage, sharedPage, "cf-02");
		const conflicted = await readRepoState(sharedPage, catalogName);
		expect(conflicted.value).toBe("stashConflict");

		await catalogPage.git().abortConflict();

		// Abort resets hard to `commitHeadBefore` and applies the stash: the local edit is back, the
		// pulled commit is gone again, so the same change is waiting to be pulled a second time.
		//
		// Both are polled together, and that is the point: `abortConflict` waits for the alert to
		// close, not for the command behind it, and the command clears the state only after it has
		// put the working copy back (`RepositoryState.abortMerge`). Asserting the state after the
		// file settled reads that gap and fails there.
		await expect(async () => {
			expect(await readWorkdirFile(sharedPage, path())).toBe(article("Local edit cf-02"));
			expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");
		}).toPass({ timeout: 60_000 });

		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();
		expect((await readSyncCount(sharedPage, catalogName)).pull).toBeGreaterThan(0);
	});

	test("a reload leaves the stash conflict standing", async ({ catalogPage, sharedPage }) => {
		await raiseConflict(catalogPage, sharedPage, "cf-05");
		const before = await readRepoState(sharedPage, catalogName);
		expect(before.value).toBe("stashConflict");

		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		// `getState` only acts on `checkout` and `syncing` (`WorkdirRepository.ts:288-296`), so a
		// stash conflict is neither restored nor cleared — it is still there, waiting, with its stash.
		const after = await readRepoState(sharedPage, catalogName);
		expect(after.value).toBe("stashConflict");
		expect(after.stashHash).toBe(before.stashHash);
		expect(await listRepoStashes(sharedPage, catalogName)).toContain(before.stashHash);

		// Left resolved so the temp repository is not deleted mid-conflict.
		await resolveConflict(sharedPage, catalogName, [
			{ content: article("Resolved after the reload"), path: after.conflictPaths![0]! },
		]);
	});
});
