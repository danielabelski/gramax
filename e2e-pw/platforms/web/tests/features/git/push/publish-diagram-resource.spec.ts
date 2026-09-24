import { expect } from "@playwright/test";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { ARTICLE_TITLE, prepareLinkedCatalog, remoteCatalogUrl } from "../catalog-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

let catalogName: string;

test.describe("publish an article together with its resource", () => {
	test("links a fresh catalog to its repository", async ({ catalogPage, sharedPage, tempRepoName }) => {
		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName });

		const git = catalogPage.git();
		await git.assertNothingToPublish();
		await git.closePublish();
	});

	test("a mermaid diagram is stored as a resource of the article", async ({ catalogPage, sharedPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const editor = new ArticleEditorPom(catalogPage);
		await editor.setMarkdown("(*)");
		await editor.focus();

		await editor.clickToolbar("semiBlocks");
		await sharedPage.getByRole("menuitemradio", { name: "Mermaid" }).click();
		await catalogPage.waitForLoad();

		await expect(sharedPage.getByRole("figure", { name: "Diagram" }).first()).toBeVisible();
		await editor.assertMarkdownContains(/\.mermaid/);
	});

	test("the publish tab shows the article and, in advanced mode, its resource", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.openPublish();

		await expect(git.publishTab.getByText(ARTICLE_TITLE, { exact: true })).toBeVisible({ timeout: 60_000 });

		await git.toggleDiffExtendedMode();
		await expect(git.publishTab.getByText(/\.mermaid/).first()).toBeVisible({
			timeout: 60_000,
		});
	});

	test("publishing pushes the article and the resource in one commit", async ({ catalogPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.publish("e2e: publish an article with a diagram");

		await git.assertNothingToPublish();
	});
});
