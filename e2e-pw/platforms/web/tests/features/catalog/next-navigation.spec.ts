import { expect } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// "Next" walks the flattened navigation: every article and every section, in navigation order,
// and disappears on the last one.
const order = ["first", "second", "second/inner", "third"];

catalogTest.use({
	startUrl: "/next-catalog/first",
	files: {
		"next-catalog": {
			"doc-root.yml": "title: Next Catalog\n",
			"_index.md": "---\ntitle: Root\n---\n\nroot",
			"first.md": "---\ntitle: First\norder: 1\n---\n\nfirst",
			second: {
				"_index.md": "---\ntitle: Second\norder: 2\n---\n\nsecond",
				"inner.md": "---\ntitle: Inner\norder: 1\n---\n\ninner",
			},
			"third.md": "---\ntitle: Third\norder: 3\n---\n\nthird",
		},
	},
});

catalogTest("the next button walks the catalog to its last article", async ({ catalogPage, sharedPage }) => {
	await catalogPage.waitForLoad();
	await expect(sharedPage).toHaveURL(/\/next-catalog\/first$/);

	for (const path of order.slice(1)) {
		await expect(catalogPage.nextArticleLink).toBeVisible();
		await catalogPage.nextArticleLink.click();
		await expect(sharedPage).toHaveURL(new RegExp(`/next-catalog/${path}$`));
		await catalogPage.assertNoModal();
	}

	// The last article has nowhere left to go.
	await expect(catalogPage.nextArticleLink).toHaveCount(0);
});
