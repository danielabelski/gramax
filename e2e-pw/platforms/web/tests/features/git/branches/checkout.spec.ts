import { expect } from "@playwright/test";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ARTICLE_TEXT, prepareLinkedCatalog, remoteCatalogUrl } from "../catalog-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const BRANCH = "dev";

let catalogName: string;

test.describe("checkout without local changes", () => {
	test("links a fresh catalog and branches off master", async ({ catalogPage, sharedPage, tempRepoName }) => {
		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName });

		const git = catalogPage.git();
		await git.createBranch(BRANCH);
		await git.assertCurrentBranch(BRANCH);
	});

	test("switching back to master keeps the article intact", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName, undefined, BRANCH));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.switchBranch("master");
		await git.assertCurrentBranch("master");

		const content = await catalogPage.currentArticleContent();
		expect(content.md).toContain(ARTICLE_TEXT);
	});

	test("nothing is left to publish after the checkout", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.assertCurrentBranch("master");
		await git.assertNothingToPublish();
	});
});
