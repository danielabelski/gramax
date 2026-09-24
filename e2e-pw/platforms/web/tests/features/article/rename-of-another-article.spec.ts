import { expect } from "@playwright/test";
import { addRootArticleButton } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";

// A rename is a round trip, and the reader can open another article while it is in flight. Then the
// article that moved is not the one on screen: the event is global, and a page that takes it without
// checking moves its url to another article and its writes into another article's file.

catalogTest.use({
	startUrl: "/cross-rename/other",
	files: {
		"cross-rename": {
			"doc-root.yml": "title: Cross Rename\n",
			"other.md": "---\ntitle: Other\n---\n\nother stub",
		},
	},
});

const RENAME_RESPONSE_DELAY = 3000;

const delayRenameResponse = (delay: number) => {
	const w = window as unknown as {
		commands: Record<string, Record<string, { do: (params: unknown) => Promise<unknown> }>>;
	};
	const cmd = w.commands.item!.updateProps!;
	const original = cmd.do.bind(cmd);
	cmd.do = async (params: unknown) => {
		const result = await original(params);
		await new Promise((resolve) => setTimeout(resolve, delay));
		return result;
	};
};

catalogTest(
	"a rename landing while another article is open leaves that article alone",
	async ({ basePage, sharedPage, catalogPage }) => {
		const editor = new ArticleEditorPom(catalogPage);
		await basePage.waitForLoad();
		await sharedPage.evaluate(delayRenameResponse, RENAME_RESPONSE_DELAY);

		await addRootArticleButton(sharedPage).click();
		await basePage.waitForLoad();

		await sharedPage.keyboard.type("Alpha");
		await sharedPage.keyboard.press("Enter");

		// Leave for another article without waiting for the response.
		await sharedPage.locator('[data-qa^="catalog-navigation-article-link"]', { hasText: "Other" }).first().click();
		await expect(async () => {
			expect(sharedPage.url()).toContain("/other");
		}).toPass({ timeout: 10_000 });
		await basePage.waitForLoad();

		// The tree item with the new title appears from the rename response — so it has landed, and
		// everything below happens after it.
		await expect(
			sharedPage.locator('[data-qa^="catalog-navigation-article-link"]', { hasText: "Alpha" }).first(),
		).toBeVisible({ timeout: 20_000 });

		// The url stayed where the reader went: another article's move does not drag it away.
		expect(sharedPage.url()).toContain("/other");

		await editor.body.getByRole("paragraph").last().click();
		await sharedPage.keyboard.press("End");
		await editor.type(" plus other body");
		await editor.forceSave();

		// Reads the open article's file: a write addressed elsewhere never reaches it.
		await expect(async () => {
			expect(await editor.markdown()).toContain("plus other body");
		}).toPass({ timeout: 10_000 });

		// And the renamed article did not receive the other one's text.
		const alphaContent = await catalogPage.evaluateOnApp(async () => {
			const app = await window.app!;
			const catalog = await app.wm.current().getContextlessCatalog("cross-rename");
			const article = catalog.findArticle("cross-rename/alpha", []);
			return article ? await article.getContent() : null;
		});
		expect(alphaContent, "the renamed article kept its own content").not.toContain("plus other body");
	},
);
