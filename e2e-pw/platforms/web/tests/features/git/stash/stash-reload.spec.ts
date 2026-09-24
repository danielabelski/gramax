import { expect, type Page } from "@playwright/test";
import { evaluateOnApp } from "@utils/app";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { remoteCatalogUrl } from "../catalog-setup";
import { listRepoStashes, readRepoState, readWorkdirFile, resolveConflict, writeWorkdirFile } from "./stash-helpers";
import { prepareStashCatalog } from "./stash-setup";

/**
 * A stash that outlives the session that took it.
 *
 * Every other case here drives a whole operation and watches it end. This one stops in the middle:
 * the stash is taken and nothing puts it back, which is what a checkout that throws, a tab that is
 * closed or a page that reloads leaves behind. The change is then a commit in `refs/stash` and
 * nowhere else — the working copy was emptied to make it — and the only thing that can give it back
 * is the next time the catalog is opened.
 *
 * It has to be tested in a browser and not only through `WorkdirRepository`: a reload throws away
 * the wasm instance and everything WASMFS was holding, and it is exactly there that git stops
 * recognising its own working copy.
 */

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const ARTICLE = "test.md";

let catalogName: string;

const path = () => `${catalogName}/${ARTICLE}`;
const article = (body: string) => `---\ntitle: Test\n---\n\n${body}\n`;

/**
 * Takes a stash and walks away from it, the way an interrupted operation does.
 *
 * `Repository.stash` is the same call a checkout and a sync make first; stopping right after it is
 * the state they leave when they die. Nothing is written to `.git/gramax/state.json`, because that
 * is written afterwards — and a checkout never wrote the stash there at all.
 */
const abandonStash = async (page: Page, catalog: string): Promise<string | null> => {
	return await evaluateOnApp(
		page,
		async (catalog: string) => {
			const { wm } = await window.app!;
			const repo = (await wm.current().getContextlessCatalog(catalog)).repo;
			const stash = await repo.stash();
			return stash ? stash.toString() : null;
		},
		catalog,
	);
};

const reopenCatalog = async (catalogPage: Parameters<typeof prepareStashCatalog>[0], page: Page) => {
	await page.reload();
	await catalogPage.goto(remoteCatalogUrl(catalogName));
	await catalogPage.waitForLoad();
};

test.describe("a stash left behind is replayed when the catalog is opened again", () => {
	test("links a fresh catalog", async ({ catalogPage, sharedPage, tempRepoName }) => {
		catalogName = tempRepoName;
		await prepareStashCatalog(catalogPage, sharedPage, { name: catalogName });

		await catalogPage.git().assertCurrentBranch("master");
	});

	test("an unpublished change put aside by an interrupted operation comes back", async ({
		catalogPage,
		sharedPage,
	}) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const edited = article("Written and never published");
		await writeWorkdirFile(sharedPage, path(), edited);

		const stash = await abandonStash(sharedPage, catalogName);
		expect(stash, "the edit has to have been put aside for there to be anything to recover").not.toBeNull();

		// The working copy is empty of it now — this is the moment a user's change exists in one place
		// only, and the session that knows about it is about to end.
		expect(await readWorkdirFile(sharedPage, path())).not.toBe(edited);
		expect(await listRepoStashes(sharedPage, catalogName)).toContain(stash);

		await reopenCatalog(catalogPage, sharedPage);

		expect(await readWorkdirFile(sharedPage, path())).toBe(edited);
		expect(await listRepoStashes(sharedPage, catalogName), "a replayed stash is dropped").toHaveLength(0);
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");
	});

	test("a change written after the stash meets it as a conflict", async ({ catalogPage, sharedPage }) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const stashed = article("Written before the interruption");
		await writeWorkdirFile(sharedPage, path(), stashed);
		const stash = await abandonStash(sharedPage, catalogName);
		expect(stash).not.toBeNull();

		// The user comes back to a catalog that looks unchanged and writes into the same article. Both
		// texts are theirs, and neither is the one to throw away.
		const written = article("Written after the interruption");
		await writeWorkdirFile(sharedPage, path(), written);

		await reopenCatalog(catalogPage, sharedPage);

		const state = await readRepoState(sharedPage, catalogName);
		expect(state.value).toBe("stashConflict");

		const content = await readWorkdirFile(sharedPage, path());
		expect(content, "the text written after the interruption is one side").toContain(
			"Written after the interruption",
		);
		expect(content, "the stash is the other side").toContain("Written before the interruption");

		// Left resolved, so the catalog is not deleted in the middle of a conflict.
		await resolveConflict(sharedPage, catalogName, [
			{ content: article("Resolved after the reload"), path: state.conflictPaths![0]! },
		]);
	});
});
