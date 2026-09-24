import { expect } from "@playwright/test";
import { commitToRemote, type GitlabProject } from "@utils/gitlab";
import { attachTimings, measure } from "@utils/timings";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { remoteCatalogUrl } from "../catalog-setup";
import {
	fileExists,
	listStashOids,
	readIndexChanges,
	readRepoState,
	readWorkdirFile,
	writeWorkdirFile,
} from "./stash-helpers";
import { IGNORED_CONTENT, IGNORED_FILE, OTHER_ARTICLE, prepareStashCatalog } from "./stash-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const LOCAL_EDIT = "Edited locally and never published";

let catalogName: string;
let project: GitlabProject;

/** Puts a commit on the remote that the app has no way of knowing about yet. */
const pushIncoming = async (article: string, body: string) =>
	await commitToRemote(
		project.id,
		[{ action: "update", content: `---\ntitle: ${article}\n---\n\n${body}\n`, filePath: `${article}.md` }],
		`e2e: incoming change to ${article}`,
	);

test.describe("sync stashes local changes", () => {
	test("links a fresh catalog and finds the repository behind it", async ({
		catalogPage,
		sharedPage,
		tempRepoName,
	}) => {
		catalogName = tempRepoName;
		project = await prepareStashCatalog(catalogPage, sharedPage, { name: catalogName });

		await catalogPage.git().assertCurrentBranch("master");
	});

	test("a clean catalog pulls without taking a stash", async ({ catalogPage, sharedPage }, testInfo) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const stashesBefore = await listStashOids(sharedPage, catalogName);
		await pushIncoming(OTHER_ARTICLE, "Incoming while nothing was changed locally");

		const git = catalogPage.git();
		await measure(testInfo, "sync-clean", () => git.sync());
		await catalogPage.waitForLoad();

		const other = await readWorkdirFile(sharedPage, `${catalogName}/${OTHER_ARTICLE}.md`);
		expect(other).toContain("Incoming while nothing was changed locally");

		// Nothing to stash means no stash at all, not an empty one: `Repository.stash` returns null.
		expect(await listStashOids(sharedPage, catalogName)).toEqual(stashesBefore);
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");

		await attachTimings(testInfo);
	});

	test("an unpublished edit survives a pull that touches another file", async ({
		catalogPage,
		sharedPage,
	}, testInfo) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const editor = new ArticleEditorPom(catalogPage);
		await editor.rewrite(LOCAL_EDIT);
		await editor.assertMarkdownContains(LOCAL_EDIT);

		// The precondition for stashing anything on web: nothing calls `gvc.add()` here, so the edited
		// file can only have reached the index through the file-provider events behind the edit. Were
		// it missing, `Repository.stash()` would return null and the pull would run over the edit.
		expect(await readIndexChanges(sharedPage, catalogName)).toContainEqual(expect.stringContaining("test.md"));

		await pushIncoming(OTHER_ARTICLE, "Incoming alongside an unpublished local edit");

		const git = catalogPage.git();
		await measure(testInfo, "sync-dirty", () => git.sync());
		await catalogPage.waitForLoad();

		expect(await readWorkdirFile(sharedPage, `${catalogName}/test.md`)).toContain(LOCAL_EDIT);
		expect(await readWorkdirFile(sharedPage, `${catalogName}/${OTHER_ARTICLE}.md`)).toContain(
			"Incoming alongside an unpublished local edit",
		);

		// A clean apply drops the stash and clears the state; anything left here would be restored
		// again on the next load.
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");

		await attachTimings(testInfo);
	});

	// The control for the failed-pull case: a successful pull never resets, so nothing that
	// git was told to ignore should be touched.
	test("an ignored file survives a successful pull", async ({ catalogPage, sharedPage }, testInfo) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const ignoredPath = `${catalogName}/${IGNORED_FILE}`;
		await writeWorkdirFile(sharedPage, ignoredPath, IGNORED_CONTENT);
		expect(await fileExists(sharedPage, ignoredPath)).toBe(true);

		await pushIncoming(OTHER_ARTICLE, "Incoming while an ignored file sat in the working copy");

		const git = catalogPage.git();
		await measure(testInfo, "sync-ignored", () => git.sync());
		await catalogPage.waitForLoad();

		expect(await fileExists(sharedPage, ignoredPath)).toBe(true);
		expect(await readWorkdirFile(sharedPage, ignoredPath)).toBe(IGNORED_CONTENT);

		await attachTimings(testInfo);
	});
});
