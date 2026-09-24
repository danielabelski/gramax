import { type Page, test, type WebContext } from "@playwright/test";
import "@utils/async";
import { gotoWhenReady } from "@utils/navigation";

export interface BaseFixture {
	startUrl: string;
	sharedContext: WebContext;
	sharedPage: Page;
}

export const baseTest = test.extend<object, BaseFixture>({
	startUrl: ["/", { option: true, scope: "worker" }],

	sharedContext: [
		async ({ browser }, use) => {
			const context = await browser.newContext();
			await use(context);
			await context.close();
		},
		{ scope: "worker" },
	],

	sharedPage: [
		async ({ sharedContext, startUrl }, use) => {
			const page = await sharedContext.newPage();
			await gotoWhenReady(page, startUrl);

			await use(page);

			await page.close();
		},
		{ scope: "worker" },
	],
});
