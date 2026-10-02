import { expect } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// gh#1021: a view shown as a table must fit the article: both of its borders are visible without scrolling
// the table sideways, whatever room the page has.

const article = (title: string) => `---\ntitle: ${title}\n---\n\n${title} text\n`;

catalogTest.use({
	startUrl: "/view-table-width/views",
	files: {
		"view-table-width": {
			"doc-root.yml": "title: View Table Width\n",
			views: {
				"_index.md": '---\ntitle: Views\n---\n\n<view defs="hierarchy=none" display="Table"/>\n',
				"one.md": article("Article one"),
				"two.md": article("Article two"),
			},
		},
	},
});

catalogTest("a table view fits the article width", async ({ basePage, sharedPage }) => {
	await sharedPage.setViewportSize({ width: 1600, height: 900 });
	await basePage.waitForLoad();

	const table = sharedPage.locator(".ProseMirror table", { hasText: "Article one" });
	await expect(table).toBeVisible();

	const box = await table.evaluate((el: HTMLElement) => {
		const scroll = el.closest(".scrollableContent") as HTMLElement;
		return { overflow: scroll.scrollWidth - scroll.clientWidth };
	});
	expect(box.overflow).toBeLessThanOrEqual(0);
});
