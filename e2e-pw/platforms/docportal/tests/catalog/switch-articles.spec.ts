import { baseTest as test } from "@docportal/fixtures/base.fixture";
import { expect } from "@playwright/test";
import { getTestRepoInfoFromEnv } from "@utils/source";

// isolated: false sends the worker-shared page back to startUrl before each test; each test starts from
// the home page catalog card.
test.use({ source: "env", user: "env", isolated: false });

// The catalog folder takes its name from the cloned repository, so both come from the env.
const repo = getTestRepoInfoFromEnv();

const catalogs = [
	{ name: repo.testRepo, humanName: "Автотест", anchor: "Catalog" },
	{ name: repo.testRepoNoIndex, humanName: "No Index", anchor: "Article H1" },
] as const;

test.describe("switch articles", () => {
	test.describe.configure({ timeout: 300_000 });

	for (const { name, humanName, anchor } of catalogs) {
		test(name, async ({ basePage }) => {
			const page = basePage.raw;

			await page.getByRole("button", { name: humanName }).click();
			await basePage.waitForLoad();

			const articles = page.locator("[data-qa^='catalog-navigation-']").filter({ hasText: anchor });

			let count = await articles.count();

			expect(count).toBeGreaterThan(0);

			for (let i = 0; i < count; i++) {
				await articles.nth(i).click();
				await basePage.waitForLoad();
				await basePage.assertNoModal();
				count = await articles.count();
			}
		});
	}
});
