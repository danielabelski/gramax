import { expect } from "@playwright/test";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { ARTICLE_TITLE, prepareLinkedCatalog, remoteCatalogUrl } from "../catalog-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const BRANCH = "dev-del";
const MASTER_TEXT = "Changed on master while the branch deleted the file";

let catalogName: string;

test.describe("merge a branch that deleted a changed file", () => {
	test("the branch deletes the article and publishes the deletion", async ({
		catalogPage,
		sharedPage,
		tempRepoName,
	}) => {
		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName });

		const git = catalogPage.git();
		await git.createBranch(BRANCH);
		await git.assertCurrentBranch(BRANCH);

		await catalogPage.deleteNavItem(ARTICLE_TITLE);

		await git.publish("e2e: delete the article on the branch");
		await git.assertNothingToPublish();
	});

	test("master changes the same article and publishes it", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName, undefined, BRANCH));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.switchBranch("master");

		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const editor = new ArticleEditorPom(catalogPage);
		await editor.rewrite(MASTER_TEXT);
		await editor.assertMarkdownContains(MASTER_TEXT);

		await git.publish("e2e: change the article on master");
		await git.assertNothingToPublish();
	});

	test("merging reports the conflict and the resolver completes the merge", async ({ catalogPage, sharedPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.assertCurrentBranch("master");

		await git.mergeCurrentInto(BRANCH);

		const conflict = sharedPage.getByRole("alertdialog");
		await expect(conflict.getByText("Failed to merge branches")).toBeVisible({
			timeout: 120_000,
		});
		await conflict.getByRole("button", { name: "Resolve conflict" }).click();

		const resolver = sharedPage.getByRole("dialog", { name: "Resolve conflict" });
		await expect(resolver).toBeVisible({ timeout: 120_000 });

		// The file was changed here and deleted on the branch, so the resolver offers the file as a
		// whole — "Delete" or "Leave" — instead of the usual per-hunk choices. Keeping it is the point.
		const keepFile = resolver.getByText("Leave", { exact: true });
		await expect(keepFile).toBeVisible({ timeout: 120_000 });
		await keepFile.click();

		// The editor inside the dialog goes away the moment the request starts, so only the dialog
		// closing means the merge actually finished; leaving earlier cancels it mid-flight.
		await resolver.getByRole("button", { name: "Confirm" }).click();
		await expect(resolver).toBeHidden({ timeout: 120_000 });
	});

	test("the resolved article is back on the merged branch", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName, undefined, BRANCH));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.assertCurrentBranch(BRANCH);

		const content = await catalogPage.currentArticleContent();
		expect(content.md).toContain(MASTER_TEXT);
	});
});
