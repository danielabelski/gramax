import { expect } from "@playwright/test";
import { addRootArticleButton, addSubArticleButton, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// Renaming a section moves its folder, so an article started inside it while the answer is still in
// flight names a parent that has moved. The new article has to land under that parent all the same.

catalogTest.use({
	startUrl: "/section-create/start",
	files: {
		"section-create": {
			"doc-root.yml": "title: Section Create\n",
			"start.md": "---\ntitle: Start\n---\n\nstub",
		},
	},
});

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

catalogTest("an article started under a moving section lands inside it", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await addRootArticleButton(sharedPage).click();
	await basePage.waitForLoad();
	const sectionUrl = new URL(sharedPage.url()).pathname;

	await navItem(sharedPage, "Untitled").hover();
	await addSubArticleButton(sharedPage, "Untitled").click();
	await basePage.waitForLoad();
	await sharedPage.keyboard.type("Child");
	await sharedPage.keyboard.press("Enter");
	await expect(async () => expect(sharedPage.url()).toContain("/untitled/child")).toPass({ timeout: 10_000 });
	await basePage.waitForLoad();

	// Back to the section, rename it — and add an article under its child before the answer lands.
	await basePage.navigate(sectionUrl);
	await basePage.waitForLoad();
	await sharedPage.evaluate(delayRenameResponse, 3000);
	await sharedPage.locator('[data-testid="article-editor"] .ProseMirror > *').first().click();
	await sharedPage.keyboard.type("Alpha");
	await sharedPage.keyboard.press("Enter");

	await navItem(sharedPage, "Child").hover();
	await addSubArticleButton(sharedPage, "Child").click();

	await expect(async () => expect(sharedPage.url()).toContain("/alpha/child/untitled")).toPass({ timeout: 20_000 });
});
