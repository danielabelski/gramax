import { gitTest as test } from "@web/fixtures/git.fixture";
import { prepareLinkedCatalog, remoteCatalogUrl } from "../catalog-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const BRANCH = "temp-branch";

let catalogName: string;

test.describe("delete a branch", () => {
	test("links a fresh catalog and branches off master", async ({ catalogPage, sharedPage, tempRepoName }) => {
		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName });

		const git = catalogPage.git();
		await git.createBranch(BRANCH);
		await git.switchBranch("master");
		await git.assertBranchListed(BRANCH);
	});

	test("the branch disappears from the list once deleted", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.assertCurrentBranch("master");

		await git.deleteBranch(BRANCH);
		await git.assertBranchNotListed(BRANCH);
	});

	test("the branch is still gone after a reload", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.assertCurrentBranch("master");
		await git.assertBranchNotListed(BRANCH);
	});
});
