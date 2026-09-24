import { expect } from "@playwright/test";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { homeTest as test } from "@web/fixtures/home.fixture";
import { ClonePom } from "@web/pom/clone.pom";

test.use({});

const source = getSourceDataFromEnv();
const repo = getTestRepoInfoFromEnv();

const catalogTitle = "Автотест";

test.describe
	.serial("test-catalog", () => {
		test("clone", async ({ homePage, sharedPage }) => {
			test.slow();

			const clone = new ClonePom(homePage);
			await clone.cloneWithNewStorage(source, {
				group: repo.group,
				repo: repo.testRepo,
			});
			await clone.openCatalog(catalogTitle);

			await sharedPage.getByRole("link", { name: catalogTitle }).click();
			await homePage.waitForLoad();
		});

		test("switch versions", async ({ basePage }) => {
			const page = basePage.raw;

			await page.getByRole("button", { name: "Автотест" }).click();
			await basePage.waitForLoad();

			// master -> Z. Only refs the clone holds locally count as versions, and a fresh clone holds
			// `master` plus the tags — `x` and `test/g` stay remote-tracking here, so the branch legs of
			// this scenario belong to the bare clone the docportal serves
			// (platforms/docportal/tests/catalog/switch-versions.spec.ts).
			await page.locator('[data-testid="switch-version-trigger"]:visible').click();
			await page.getByRole("menuitemradio", { name: "Z" }).click();
			await basePage.waitForLoad();
			await basePage.assertNoModal();
			expect(basePage.url).toContain(`/${repo.testRepo}:Z`);

			// Navigation rows are buttons; only a row that is neither selected nor top-level wraps its
			// button in a link.
			await page.getByRole("button", { name: "Тег", exact: true }).click();
			await basePage.waitForLoad();
			await basePage.assertNoModal();
			expect(basePage.url).toContain(`/${repo.testRepo}:Z/teg`);

			// Z -> master: the version drops out of the address, the article stays open.
			await page.locator('[data-testid="switch-version-trigger"]:visible').click();
			await page.getByRole("menuitemradio", { name: "master" }).click();
			await basePage.waitForLoad();
			await basePage.assertNoModal();
			expect(basePage.url).toContain("/teg");
			expect(basePage.url).not.toContain(`${repo.testRepo}:`);
		});
	});
