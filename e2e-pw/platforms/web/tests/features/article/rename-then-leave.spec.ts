import { expect } from "@playwright/test";
import { addRootArticleButton, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// Text typed right after the title is saved by a write that waits for the rename to answer. The
// author may leave the article before it does; the write still has to reach the renamed file.

catalogTest.use({
	startUrl: "/leave-rename/start",
	files: {
		"leave-rename": {
			"doc-root.yml": "title: Leave\n",
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
	"text typed before leaving the article reaches the renamed file",
	async ({ basePage, sharedPage, catalogPage }) => {
		await basePage.waitForLoad();
		await sharedPage.evaluate(delayRenameResponse, RENAME_RESPONSE_DELAY);

		await addRootArticleButton(sharedPage).click();
		await basePage.waitForLoad();

		await sharedPage.keyboard.type("Alpha");
		await sharedPage.keyboard.press("Enter");
		await sharedPage.keyboard.type("left behind");
		// The body write is debounced; once it fires it waits for the rename, which is stuck.
		await sharedPage.waitForTimeout(800);

		await navItem(sharedPage, "Start").click();
		await expect(async () => expect(sharedPage.url()).toContain("/start")).toPass({ timeout: 10_000 });
		await basePage.waitForLoad();

		// The tree follows the rename once it lands; the renamed article then holds the text.
		await navItem(sharedPage, "Alpha").click({ timeout: 20_000 });
		await expect(async () => expect(sharedPage.url()).toContain("/alpha")).toPass({ timeout: 10_000 });
		await basePage.waitForLoad();
		await expect(async () => {
			expect((await catalogPage.currentArticleContent()).md).toContain("left behind");
		}).toPass({ timeout: 20_000 });
	},
);
