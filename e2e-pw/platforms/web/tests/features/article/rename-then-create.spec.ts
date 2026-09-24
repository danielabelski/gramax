import { expect } from "@playwright/test";
import { addRootArticleButton, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// A new article takes the placeholder name the renamed one has just freed. The rename's answer,
// landing after that, names the same path — and must not be taken for the new article.

catalogTest.use({
	startUrl: "/create-rename/start",
	files: {
		"create-rename": {
			"doc-root.yml": "title: Create\n",
			"start.md": "---\ntitle: Start\n---\n\nstub",
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
	"an article created while the previous one is being renamed keeps its own file",
	async ({ basePage, sharedPage, catalogPage }) => {
		await basePage.waitForLoad();
		await sharedPage.evaluate(delayRenameResponse, RENAME_RESPONSE_DELAY);

		await addRootArticleButton(sharedPage).click();
		await basePage.waitForLoad();
		await sharedPage.keyboard.type("Alpha");
		await sharedPage.keyboard.press("Enter");
		// The file moves long before the delayed answer arrives: once it has, the placeholder name is
		// free and the next article takes it.
		await expect(async () => {
			const moved = await sharedPage.evaluate(async () => {
				const app = await window.app!;
				const catalog = await app.wm.current().getContextlessCatalog("create-rename");
				return !!catalog.findArticle("create-rename/alpha", []);
			});
			expect(moved).toBe(true);
		}).toPass({ timeout: 10_000 });

		// The click waits out the pending rename instead of anchoring the new article to a file that
		// has already moved: the first article lands on its new name, and only then the second opens —
		// on the placeholder name the first has just freed.
		await addRootArticleButton(sharedPage).click();
		await expect(navItem(sharedPage, "Alpha")).toBeVisible({ timeout: 20_000 });
		await expect(async () => {
			expect(new URL(sharedPage.url()).pathname.endsWith("/untitled")).toBe(true);
		}).toPass({ timeout: 20_000 });
		await basePage.waitForLoad();

		await sharedPage.keyboard.type("Beta");
		await sharedPage.keyboard.press("Enter");
		await sharedPage.keyboard.type("beta body");

		// The late answer for the first article lands while the second is open on the same path.
		// The second stays itself: its own rename, its own text.
		await expect(async () => expect(sharedPage.url()).toContain("/beta")).toPass({ timeout: 20_000 });
		await basePage.waitForLoad();
		await expect(async () => {
			expect((await catalogPage.currentArticleContent()).md).toContain("beta body");
		}).toPass({ timeout: 20_000 });

		await navItem(sharedPage, "Alpha").click();
		await expect(async () => expect(sharedPage.url()).toContain("/alpha")).toPass({ timeout: 10_000 });
		await basePage.waitForLoad();
		expect((await catalogPage.currentArticleContent()).md).not.toContain("beta body");
	},
);
