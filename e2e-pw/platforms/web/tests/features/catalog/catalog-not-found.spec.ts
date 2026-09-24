import { expect } from "@playwright/test";
import { baseTest as test } from "@web/fixtures/base.fixture";

const missingCatalogPath = "/-/-/-/-/no-such-catalog/no-such-article";

test.describe("Catalog not found page", () => {
	test("renders the 404 article instead of a blank screen", async ({ sharedPage, basePage }) => {
		const uncaught: string[] = [];
		sharedPage.on("pageerror", (error) => uncaught.push(error.message));

		await sharedPage.goto(missingCatalogPath, { waitUntil: "domcontentloaded" });
		await basePage.waitForLoad();

		await expect(sharedPage.getByRole("heading", { name: "Catalog not found" })).toBeVisible();
		await expect(sharedPage.getByText("Check that the path is correct")).toBeVisible();
		expect(uncaught.filter((message) => message.includes("Cannot read properties of null"))).toEqual([]);
	});
});
