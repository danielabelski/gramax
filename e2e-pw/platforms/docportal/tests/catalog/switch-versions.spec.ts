import { baseTest as test } from "@docportal/fixtures/base.fixture";
import { expect } from "@playwright/test";
import { env } from "@utils/utils";

test.use({ source: "env", user: "env" });

const catalog = env("GX_E2E_GIT_TEST_REPO");

test.describe("versions", () => {
	test("switch version in test-catalog", async ({ basePage }) => {
		const page = basePage.raw;
		const switchingSpinner = page.getByRole("complementary").getByRole("progressbar");

		// The page is shared by every test in the worker, so its size and location are whatever the previous
		// test left. Below ~1316px the right navigation collapses into an icon trigger with no switching spinner.
		await page.setViewportSize({ width: 1600, height: 900 });
		await page.goto(`/${catalog}/teg`);
		await basePage.waitForLoad();

		// master -> Z
		await page.getByRole("complementary").getByText("master").click();
		await page.getByRole("menuitemradio", { name: "Z" }).click();
		await basePage.waitForLoad();
		await basePage.assertNoModal();
		basePage.assertUrl(`/${catalog}:Z/teg`);
		await expect(switchingSpinner).toBeHidden();

		// Z -> x (branch without this article - expect error)
		await page.getByRole("complementary").getByText("Z").click();
		await page.getByRole("menuitemradio", { name: "x" }).click();
		await basePage.waitForLoad();
		await expect(page.getByText("Check that the path is correct")).toBeVisible();
		basePage.assertUrl(`/${catalog}:x/teg`);
		await expect(switchingSpinner).toBeHidden();

		// x -> test/g
		await page.getByRole("complementary").getByText("x", { exact: true }).click();
		await page.getByRole("menuitemradio", { name: "test/g" }).click();
		await basePage.waitForLoad();
		await basePage.assertNoModal();
		await expect(switchingSpinner).toBeHidden();

		// test/g -> master
		await page.getByRole("complementary").getByText("test/g").click();
		await page.getByRole("menuitemradio", { name: "master" }).click();
		await basePage.waitForLoad();
		await basePage.assertNoModal();
		basePage.assertUrl(`/${catalog}/teg`);
		await expect(switchingSpinner).toBeHidden();
	});
});
