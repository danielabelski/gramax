import { expect } from "@playwright/test";
import { attachTimings, measure } from "@utils/timings";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { remoteCatalogUrl } from "../catalog-setup";
import { listRepoStashes, readRepoState, readWorkdirFile, resolveConflict } from "./stash-helpers";
import { prepareStashCatalog } from "./stash-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const BRANCH = "co-10";
const ARTICLE = "test.md";
const BRANCH_TEXT = "Committed on the branch";
const MASTER_TEXT = "Edited on master, never published";

let catalogName: string;

const path = () => `${catalogName}/${ARTICLE}`;
const article = (body: string) => `---\ntitle: Test\n---\n\n${body}\n`;

test.describe("a checkout whose stash cannot be replayed", () => {
	test("links a fresh catalog and commits a change on a branch", async ({
		catalogPage,
		sharedPage,
		tempRepoName,
	}) => {
		catalogName = tempRepoName;
		await prepareStashCatalog(catalogPage, sharedPage, { name: catalogName });

		const git = catalogPage.git();
		await git.createBranch(BRANCH);

		// Through the editor rather than the file provider: the publish panel is fed by the UI's own
		// index service, and a write straight to disk reaches git without the panel ever hearing of it
		// — the change is real, but there is nothing on screen to publish.
		const editor = new ArticleEditorPom(catalogPage);
		await editor.rewrite(BRANCH_TEXT);
		await editor.assertMarkdownContains(BRANCH_TEXT);

		await git.publish("e2e: change the article on the branch");

		await git.switchBranch("master");
		await git.assertCurrentBranch("master");
	});

	test("the overlap is recorded as a stash conflict, and the app offers to resolve it", async ({
		catalogPage,
		sharedPage,
	}, testInfo) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const editor = new ArticleEditorPom(catalogPage);
		await editor.rewrite(MASTER_TEXT);
		await editor.assertMarkdownContains(MASTER_TEXT);

		const git = catalogPage.git();
		await measure(testInfo, "checkout-conflict-ui", () => git.switchBranch(BRANCH));

		const state = await readRepoState(sharedPage, catalogName);
		expect(state.value).toBe("stashConflict");
		expect(state.stashHash).toBeTruthy();
		expect(state.conflictPaths).toContainEqual(expect.stringContaining(ARTICLE));
		expect(await listRepoStashes(sharedPage, catalogName)).toContain(state.stashHash);

		// The checkout command does throw the conflict away — `WorkdirRepository.checkout` returns the
		// conflicting files and `app/commands/versionControl/branch/checkout.ts:23` answers with a
		// pathname instead — but the frontend never needed them: `BranchActions.switchBranch` asks
		// `getMergeData` right after the checkout and raises the dialog off the repository state.
		// The resolver itself stays closed until the dialog's own button opens it.
		await expect(git.conflictResolver).toBeHidden();
		await expect(git.syncConflictAlert).toBeVisible();

		await attachTimings(testInfo);
	});

	test("resolving it drops the stash and clears the state", async ({ catalogPage, sharedPage }) => {
		const resolved = article("Resolved after a checkout conflict");

		const before = await readRepoState(sharedPage, catalogName);
		await resolveConflict(sharedPage, catalogName, [{ content: resolved, path: before.conflictPaths![0]! }]);

		expect(await readWorkdirFile(sharedPage, path())).toBe(resolved);
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");
		expect(await listRepoStashes(sharedPage, catalogName)).not.toContain(before.stashHash);

		await catalogPage.goto(remoteCatalogUrl(catalogName, undefined, BRANCH));
		await catalogPage.waitForLoad();
		await catalogPage.git().assertCurrentBranch(BRANCH);
	});
});
