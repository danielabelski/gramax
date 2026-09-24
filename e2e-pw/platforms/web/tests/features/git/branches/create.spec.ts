import { gitTest as test } from "@web/fixtures/git.fixture";
import { prepareLinkedCatalog, remoteCatalogUrl } from "../catalog-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const BRANCH = "dev";

let catalogName: string;

test.describe("create a branch", () => {
	test("links a fresh catalog to its repository", async ({ catalogPage, sharedPage, tempRepoName }) => {
		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName });

		await catalogPage.git().assertCurrentBranch("master");
	});

	test("a new branch is created and checked out", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.createBranch(BRANCH);

		await git.assertCurrentBranch(BRANCH);
	});

	test("the new branch is listed next to master", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName, undefined, BRANCH));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.assertCurrentBranch(BRANCH);
		await git.assertBranchListed("master");

		await git.switchBranch("master");
		await git.assertBranchListed(BRANCH);
	});
});
