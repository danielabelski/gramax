import { expect } from "@playwright/test";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { ARTICLE_TITLE, prepareLinkedCatalog, remoteCatalogUrl } from "../catalog-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const EDITED_TEXT = "Edited before publishing";

let catalogName: string;

test.describe("commit and publish", () => {
	test("links a fresh catalog to its repository", async ({ catalogPage, sharedPage, tempRepoName }) => {
		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName });

		const git = catalogPage.git();
		await git.assertCurrentBranch("master");
		await git.assertNothingToPublish();
		await git.closePublish();
	});

	test("an edited article shows up as a change", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const editor = new ArticleEditorPom(catalogPage);
		await editor.rewrite(EDITED_TEXT);
		await editor.assertMarkdownContains(EDITED_TEXT);

		const git = catalogPage.git();
		await git.openPublish();
		await expect(git.publishTab.getByText(ARTICLE_TITLE, { exact: true })).toBeVisible({ timeout: 60_000 });
	});

	test("publishing commits the change and leaves nothing pending", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.publish("e2e: publish the edited article");

		await git.assertNothingToPublish();
	});
});
