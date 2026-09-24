import { expect } from "@playwright/test";
import { addRootArticleButton, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// The author types a title and clicks another article before the rename answers. The answer must not
// pull the page back: the click stands, and the article it opened has to arrive.

catalogTest.use({
	startUrl: "/nav-rename/start",
	files: {
		"nav-rename": {
			"doc-root.yml": "title: Nav Rename\n",
			"start.md": "---\ntitle: Start\n---\n\nstart body",
		},
	},
});

const RENAME_RESPONSE_DELAY = 1500;
const PAGE_READ_DELAY = 3500;

// The rename answers late; every page read after this answers later still, so the answer lands
// while the next article is on its way.
const delayResponses = ({ rename, read }: { rename: number; read: number }) => {
	const w = window as unknown as {
		commands: Record<string, Record<string, { do: (params: unknown) => Promise<unknown> }>>;
	};
	const wrap = (cmd: { do: (params: unknown) => Promise<unknown> }, delay: number) => {
		const original = cmd.do.bind(cmd);
		cmd.do = async (params: unknown) => {
			const result = await original(params);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return result;
		};
	};
	wrap(w.commands.item!.updateProps!, rename);
	wrap(w.commands.page!.getPageData!, read);
};

catalogTest("a rename landing mid-navigation does not pull the page back", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	await addRootArticleButton(sharedPage).click();
	await basePage.waitForLoad();
	await sharedPage.evaluate(delayResponses, { rename: RENAME_RESPONSE_DELAY, read: PAGE_READ_DELAY });

	await sharedPage.keyboard.type("Alpha");
	await sharedPage.keyboard.press("Enter");
	await navItem(sharedPage, "Start").click();

	await sharedPage.waitForTimeout(RENAME_RESPONSE_DELAY + PAGE_READ_DELAY + 1000);
	expect(sharedPage.url()).toContain("/start");
	await expect(sharedPage.getByTestId("article-editor")).toContainText("start body");
});
