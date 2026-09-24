import { expect } from "@playwright/test";
import { addRootArticleButton } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// A rename moves the file on disk before the client learns the new path: the response is still in
// flight. A title edit sent into that window is addressed to a path that is gone — the server
// resolves the article from the request body, finds nothing and drops it silently. The title is lost
// for good: nothing sends it a second time. The spec opens the window itself by delaying the
// response, with the disk work already done.

catalogTest.use({
	startUrl: "/flight-title/start",
	files: {
		"flight-title": {
			"doc-root.yml": "title: Flight\n",
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
	"a title typed while the rename is in flight reaches the renamed article",
	async ({ basePage, sharedPage, catalogPage }) => {
		await basePage.waitForLoad();
		await sharedPage.evaluate(delayRenameResponse, RENAME_RESPONSE_DELAY);

		await addRootArticleButton(sharedPage).click();
		await basePage.waitForLoad();

		await sharedPage.keyboard.type("Alpha");
		// Leaving the title is the rename — after this the response is stuck for three seconds.
		await sharedPage.keyboard.press("Enter");

		// The same title is extended while the client still does not know where the article is.
		await sharedPage.keyboard.press("ArrowUp");
		await sharedPage.keyboard.press("End");
		await sharedPage.keyboard.type(" Two");

		await expect(async () => {
			expect(sharedPage.url()).toContain("alpha");
		}).toPass({ timeout: 20_000 });
		await basePage.waitForLoad();

		// The caret never left the title, so there is no second send: `Alpha` instead of `Alpha Two`
		// here means exactly that the edit was lost.
		await expect(async () => {
			expect((await catalogPage.currentArticleProps()).title).toBe("Alpha Two");
		}).toPass({ timeout: 20_000 });
	},
);
