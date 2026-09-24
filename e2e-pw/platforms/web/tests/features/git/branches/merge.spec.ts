import { expect } from "@playwright/test";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { prepareLinkedCatalog, remoteCatalogUrl } from "../catalog-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const BRANCH = "dev";
const BRANCH_TEXT = "Written on the dev branch";

let catalogName: string;

test.describe("merge a branch without conflicts", () => {
	test("links a fresh catalog and publishes a change on a branch", async ({
		catalogPage,
		sharedPage,
		tempRepoName,
	}) => {
		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName });

		const git = catalogPage.git();
		await git.createBranch(BRANCH);

		const editor = new ArticleEditorPom(catalogPage);
		await editor.rewrite(BRANCH_TEXT);
		await editor.assertMarkdownContains(BRANCH_TEXT);

		await git.publish("e2e: change on the dev branch");
		await git.assertNothingToPublish();
	});

	test("merging into master carries the change and removes the branch", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName, undefined, BRANCH));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.assertCurrentBranch(BRANCH);

		await git.mergeCurrentInto("master", { deleteAfterMerge: true });

		await git.assertCurrentBranch("master");
		await git.assertBranchNotListed(BRANCH);
	});

	test("master carries the merged change and has nothing left to publish", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.assertCurrentBranch("master");

		const content = await catalogPage.currentArticleContent();
		expect(content.md).toContain(BRANCH_TEXT);

		await git.assertNothingToPublish();
	});
});
