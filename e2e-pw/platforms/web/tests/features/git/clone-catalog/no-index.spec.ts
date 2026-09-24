import { expect } from "@playwright/test";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { catalogTest as test } from "@web/fixtures/catalog.fixture";
import { ClonePom } from "@web/pom/clone.pom";
import { ArticleEditorPom } from "@web/pom/editor.pom";

const source = getSourceDataFromEnv();
const repo = getTestRepoInfoFromEnv();

const catalogTitle = "No Index";

// A catalog whose folders have no `_index.md`: the articles get their titles from their H1, and
// that H1 is lifted into the frontmatter the first time the article is edited.
test.use({ source: "env", startUrl: "/" });

test.describe.configure({ mode: "serial" });

const catalogUrl = (path = "") =>
	`/${repo.host}/${encodeURIComponent(repo.group)}/${repo.testRepoNoIndex}/master/-${path}`;

test.describe("no-index catalog", () => {
	test("clone", async ({ catalogPage, sharedPage }) => {
		test.slow();

		const clone = new ClonePom(catalogPage);
		await clone.cloneCatalog({
			storage: source.domain,
			group: repo.group,
			repo: repo.testRepoNoIndex,
		});
		await clone.openCatalog(catalogTitle);

		await expect(sharedPage).toHaveURL(new RegExp(`/${repo.testRepoNoIndex}/master/-`));
	});

	test("Article H1 links to the category section", async ({ catalogPage, sharedPage }) => {
		await catalogPage.goto(catalogUrl());
		await catalogPage.waitForLoad();

		await catalogPage.navItem("category").click();
		await catalogPage.waitForLoad();

		await expect(sharedPage).toHaveURL(new RegExp(`/${repo.testRepoNoIndex}/master/-/category$`));
	});

	test("the category section links back to Article H1", async ({ catalogPage, sharedPage }) => {
		await catalogPage.goto(catalogUrl("/category"));
		await catalogPage.waitForLoad();

		await catalogPage.navItem("Article H1").click();
		await catalogPage.waitForLoad();

		await expect(sharedPage).toHaveURL(new RegExp(`/${repo.testRepoNoIndex}/master/-/article$`));
	});

	test("Article H1 links to the nested inner-category", async ({ catalogPage, sharedPage }) => {
		await catalogPage.goto(catalogUrl("/article"));
		await catalogPage.waitForLoad();

		await catalogPage.navItem("inner-category").click();
		await catalogPage.waitForLoad();

		await expect(sharedPage).toHaveURL(new RegExp(`/${repo.testRepoNoIndex}/master/-/category/inner-category$`));
	});

	// Last: this one edits the article, and the navigation tests above expect it untouched.
	test("editing the article keeps the H1-derived title and stores it as a property", async ({ catalogPage }) => {
		await catalogPage.goto(catalogUrl());
		await catalogPage.waitForLoad();

		expect((await catalogPage.currentArticleProps()).title).toBe("Article H1");

		const editor = new ArticleEditorPom(catalogPage);
		await editor.bottom().click();
		await editor.type("Content");

		await editor.assertMarkdownContains("Content");
		expect((await catalogPage.currentArticleProps()).title).toBe("Article H1");
	});
});
