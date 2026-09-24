import { expect } from "@playwright/test";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { catalogTest as test } from "@web/fixtures/catalog.fixture";
import { ClonePom } from "@web/pom/clone.pom";

const source = getSourceDataFromEnv();
const repo = getTestRepoInfoFromEnv();

const catalogTitle = "Автотест";
const articlePath = "catalog/category/FirstLevel/SecondLevel/ThirdLevel/ThirdLevelArticle2";

// Both address shapes must reach the same article of a cloned catalog:
// the short legacy one, and the storage-qualified one whose branch segment may be stale.
test.use({ source: "env", startUrl: "/" });

test.describe.configure({ mode: "serial" });

test.describe("legacy article urls", () => {
	test("clone", async ({ catalogPage, sharedPage }) => {
		test.slow();

		const clone = new ClonePom(catalogPage);
		await clone.cloneCatalog({
			storage: source.domain,
			group: repo.group,
			repo: repo.testRepo,
		});
		await clone.openCatalog(catalogTitle);

		await expect(sharedPage).toHaveURL(new RegExp(`/${repo.testRepo}/master/-`));
	});

	test("the short legacy url opens the article", async ({ catalogPage }) => {
		await catalogPage.goto(`/${repo.testRepo}/${articlePath}`);
		await catalogPage.waitForLoad();

		await expect(catalogPage.raw.getByText("Check that the path is correct")).toBeHidden();
		expect(catalogPage.url).toContain(articlePath);
	});

	test("a branch that does not exist resolves to the catalog's real branch", async ({ catalogPage, sharedPage }) => {
		const group = encodeURIComponent(repo.group);
		await catalogPage.goto(`/${repo.host}/${group}/${repo.testRepo}/not-dev-branch/-/${articlePath}`);
		await catalogPage.waitForLoad();

		await expect(sharedPage).toHaveURL(new RegExp(`/${repo.testRepo}/master/-/${articlePath}$`));
		await expect(catalogPage.raw.getByText("Check that the path is correct")).toBeHidden();
	});
});
