import { expect } from "@playwright/test";
import { baseTest as test } from "@web/fixtures/base.fixture";

test.use({
	files: {
		"handoff-catalog": {
			"doc-root.yml": "title: Handoff Catalog\n",
			"article.md": "---\ntitle: Handoff article\n---\n\nThis article stays in the browser.",
		},
	},
});

test("non-production HTML omits the desktop handoff script", async ({ sharedPage }) => {
	const response = await sharedPage.request.get("/");
	expect(response.ok()).toBe(true);
	expect(await response.text()).not.toContain("127.0.0.1:52055");
});

test("opens an article in the browser even when desktop is available", async ({ sharedPage, basePage }) => {
	let desktopRequests = 0;
	await sharedPage.route("http://127.0.0.1:52055/**", async (route) => {
		desktopRequests++;
		await route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "" });
	});
	try {
		await sharedPage.evaluate(() => window.localStorage.removeItem("NO_DESKTOP"));
		await sharedPage.goto("/handoff-catalog/article");
		await basePage.waitForLoad();
		await expect(sharedPage.getByText("This article stays in the browser.", { exact: true })).toBeVisible();
		await expect(sharedPage.getByText("Opened in Gramax application", { exact: true })).not.toBeVisible();
		expect(desktopRequests).toBe(0);
	} finally {
		await sharedPage.unroute("http://127.0.0.1:52055/**");
	}
});
