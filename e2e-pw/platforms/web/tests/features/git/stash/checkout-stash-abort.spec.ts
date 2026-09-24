import { expect } from "@playwright/test";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { remoteCatalogUrl } from "../catalog-setup";
import { readBranchHead, readRepoState, readWorkdirFile } from "./stash-helpers";
import { prepareStashCatalog } from "./stash-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const BRANCH = "co-11";
const ARTICLE = "test.md";
const BRANCH_TEXT = "Committed on the branch";
const MASTER_TEXT = "Edited on master, never published";

let catalogName: string;
let branchHead: string;

const path = () => `${catalogName}/${ARTICLE}`;

// A catalog of its own rather than a case appended to `checkout-stash-conflict`: aborting clears the
// state and moves the repository back, which is not what the cases after it are set up for.
test.describe("aborting a checkout whose stash cannot be replayed", () => {
	test("links a fresh catalog and commits a change on a branch", async ({
		catalogPage,
		sharedPage,
		tempRepoName,
	}) => {
		catalogName = tempRepoName;
		await prepareStashCatalog(catalogPage, sharedPage, { name: catalogName });

		const git = catalogPage.git();
		await git.createBranch(BRANCH);

		const editor = new ArticleEditorPom(catalogPage);
		await editor.rewrite(BRANCH_TEXT);
		await editor.assertMarkdownContains(BRANCH_TEXT);

		await git.publish("e2e: change the article on the branch");
		branchHead = await readBranchHead(sharedPage, catalogName, BRANCH);
		expect(branchHead).toBeTruthy();

		await git.switchBranch("master");
		await git.assertCurrentBranch("master");
	});

	test("cancelling leaves the branch that was checked out exactly where it was", async ({
		catalogPage,
		sharedPage,
	}) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const editor = new ArticleEditorPom(catalogPage);
		await editor.rewrite(MASTER_TEXT);
		await editor.assertMarkdownContains(MASTER_TEXT);

		const git = catalogPage.git();
		await git.switchBranch(BRANCH);
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("stashConflict");

		// Cancelling aborts: the repository is reset to `commitHeadBefore`, which is a commit on the
		// branch the checkout started from. Resetting without going back there first would move the
		// branch just checked out onto that commit and lose everything published on it.
		await git.syncConflictAlert.getByRole("button", { name: "Cancel" }).click();
		await expect(git.syncConflictAlert).toBeHidden({ timeout: 60_000 });

		await expect(async () => {
			expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");
		}).toPass({ timeout: 60_000 });

		expect(await readBranchHead(sharedPage, catalogName, BRANCH)).toBe(branchHead);
		expect(await readWorkdirFile(sharedPage, path())).toContain(MASTER_TEXT);
	});
});
