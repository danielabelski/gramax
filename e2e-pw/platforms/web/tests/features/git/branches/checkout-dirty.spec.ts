import { expect } from "@playwright/test";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { ARTICLE_TITLE, prepareLinkedCatalog, remoteCatalogUrl } from "../catalog-setup";
import { listRepoStashes, readRepoState } from "../stash/stash-helpers";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const BRANCH = "dev";
const EDITED_TEXT = "Written on master, carried over to dev";

let catalogName: string;

test.describe("checkout with local changes", () => {
	test("links a fresh catalog and branches off master", async ({ catalogPage, sharedPage, tempRepoName }) => {
		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName });

		const git = catalogPage.git();
		await git.createBranch(BRANCH);
		await git.switchBranch("master");
		await git.assertCurrentBranch("master");
	});

	test("unpublished changes follow the checkout", async ({ catalogPage, sharedPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const editor = new ArticleEditorPom(catalogPage);
		await editor.setMarkdown(EDITED_TEXT);
		await editor.assertMarkdownContains(EDITED_TEXT);

		const git = catalogPage.git();
		await git.switchBranch(BRANCH);
		await git.assertCurrentBranch(BRANCH);

		const content = await catalogPage.currentArticleContent();
		expect(content.md).toContain(EDITED_TEXT);

		// The change arriving is only half of it: the stash that carried it has to be gone and the
		// repository back in its default state, or the next load applies the same stash a second time.
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");
		expect(await listRepoStashes(sharedPage, catalogName)).toEqual([]);
	});

	test("the carried-over change is published on the branch it landed on", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName, undefined, BRANCH));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.assertCurrentBranch(BRANCH);

		await git.openPublish();
		await expect(git.publishTab.getByText(ARTICLE_TITLE, { exact: true })).toBeVisible({ timeout: 60_000 });

		await git.publish("e2e: publish the carried-over change");
		await git.assertNothingToPublish();
	});
});
