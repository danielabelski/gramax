import { expect, type Page } from "@playwright/test";
import { navItem } from "@utils/catalogTree";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ARTICLE, ARTICLE_TITLE, catalogFiles, prepareLinkedCatalog } from "./catalog-setup";

// Once a sync finishes, it reads the open article again to show what came in. By then the reader may
// have moved on to another article, and what that late read brings must not land in the one now on
// screen. The sync is held open until the reader has moved, so the late read happens on every run.

// Named budgets (`@utils/budgets`) landed in develop after this release branch was cut.
const GIT_SYNC = 180_000;

const FIRST_TEXT = "Text of the article the sync started on";
const OTHER_TITLE = "Other";
const OTHER_TEXT = "Text of the article the reader moved to";

const holdSync = (page: Page) =>
	page.evaluate(() => {
		type Sync = (props: unknown) => Promise<unknown>;
		const w = window as unknown as { commands: { storage: { sync: { do: Sync } } }; releaseSync: () => void };
		const command = w.commands.storage.sync;
		const sync = command.do.bind(command) as Sync;
		const released = new Promise<void>((resolve) => {
			w.releaseSync = resolve;
		});
		command.do = async (props) => {
			const result = await sync(props);
			await released;
			return result;
		};
	});

const releaseSync = (page: Page) =>
	page.evaluate(() => (window as unknown as { releaseSync: () => void }).releaseSync());

test("a sync finishing after the reader moved on leaves the article on screen as it is", async ({
	catalogPage,
	sharedPage,
	tempRepoName,
}) => {
	await prepareLinkedCatalog(catalogPage, sharedPage, {
		name: tempRepoName,
		files: catalogFiles(tempRepoName, {
			[`${ARTICLE}.md`]: `---\ntitle: ${ARTICLE_TITLE}\n---\n\n${FIRST_TEXT}\n`,
			"other.md": `---\ntitle: ${OTHER_TITLE}\n---\n\n${OTHER_TEXT}\n`,
		}),
	});
	await expect(sharedPage.getByText(FIRST_TEXT)).toBeVisible();

	const sync = sharedPage.getByRole("button", { name: "Synchronize" });
	await holdSync(sharedPage);
	await sync.click();
	await expect(sync).toHaveAttribute("aria-busy", "true");

	await navItem(sharedPage, OTHER_TITLE).click();
	await expect(sharedPage.getByText(OTHER_TEXT)).toBeVisible();

	await releaseSync(sharedPage);
	await expect(sync).toHaveAttribute("aria-busy", "false", { timeout: GIT_SYNC });

	await expect(sharedPage.getByText(OTHER_TEXT)).toBeVisible();
	await expect(sharedPage.getByText(FIRST_TEXT)).toBeHidden();
});
