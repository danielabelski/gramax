import { expect } from "@playwright/test";
import { attachTimings, measure } from "@utils/timings";
import { gitTest as test } from "@web/fixtures/git.fixture";
import type CatalogPage from "@web/pom/catalog.page";
import { remoteCatalogUrl } from "../catalog-setup";
import {
	deleteWorkdirFile,
	discardAllChanges,
	fileExists,
	listRepoStashes,
	listStashOids,
	moveWorkdirFile,
	readRepoState,
	readWorkdirBytes,
	readWorkdirFile,
	writeWorkdirBytes,
	writeWorkdirFile,
} from "./stash-helpers";
import {
	bulkArticle,
	IGNORED_CONTENT,
	IGNORED_FILE,
	OTHER_ARTICLE,
	prepareStashCatalog,
	RESOURCE_BYTES,
	RESOURCE_FILE,
} from "./stash-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const BULK_COUNT = 10;

let catalogName: string;

const path = (file: string) => `${catalogName}/${file}`;

/**
 * Runs one checkout case on a branch of its own and leaves master clean again.
 *
 * Every case needs the same starting point — master, nothing uncommitted — and a branch to check
 * out onto. Making the branch first, going back to master to dirty the working copy, and only then
 * switching is what puts the change in front of a checkout rather than behind it.
 */
const onFreshBranch = async (
	catalogPage: CatalogPage,
	branch: string,
	dirty: () => Promise<void>,
	checkout: () => Promise<void>,
) => {
	await catalogPage.goto(remoteCatalogUrl(catalogName));
	await catalogPage.waitForLoad();

	const git = catalogPage.git();
	await git.createBranch(branch);
	await git.switchBranch("master");

	await dirty();
	await checkout();
};

/** Back to master with nothing pending, so the next case is not standing in this one's leftovers. */
const backToMaster = async (catalogPage: CatalogPage, page: Parameters<typeof discardAllChanges>[0]) => {
	await discardAllChanges(page, catalogName);
	await catalogPage.git().switchBranch("master");
};

test.describe("checkout carries local changes across", () => {
	test("links a fresh catalog", async ({ catalogPage, sharedPage, tempRepoName }) => {
		catalogName = tempRepoName;
		await prepareStashCatalog(catalogPage, sharedPage, { bulk: BULK_COUNT, name: catalogName });

		await catalogPage.git().assertCurrentBranch("master");
	});

	test("one edited file follows the checkout and the stash is dropped afterwards", async ({
		catalogPage,
		sharedPage,
	}, testInfo) => {
		const edited = "Edited on master, carried onto co-02";

		await onFreshBranch(
			catalogPage,
			"co-02",
			async () => await writeWorkdirFile(sharedPage, path("test.md"), edited),
			async () => await measure(testInfo, "checkout-dirty-1-ui", () => catalogPage.git().switchBranch("co-02")),
		);

		expect(await readWorkdirFile(sharedPage, path("test.md"))).toBe(edited);

		// A clean apply drops the stash and clears the state. Anything left behind here would be
		// applied a second time on the next load.
		const state = await readRepoState(sharedPage, catalogName);
		expect(state.value).toBe("default");

		// The app logged that it made a stash, and the repository no longer holds one.
		expect(await listStashOids(sharedPage, catalogName)).not.toHaveLength(0);
		expect(await listRepoStashes(sharedPage, catalogName)).toEqual([]);

		await backToMaster(catalogPage, sharedPage);
		await attachTimings(testInfo);
	});

	test("ten edited files all follow the checkout", async ({ catalogPage, sharedPage }, testInfo) => {
		const marker = "Edited in bulk on master";

		await onFreshBranch(
			catalogPage,
			"co-03",
			async () => {
				for (let i = 1; i <= BULK_COUNT; i++)
					await writeWorkdirFile(sharedPage, path(`${bulkArticle(i)}.md`), `${marker} ${i}`);
			},
			async () => await measure(testInfo, "checkout-dirty-10-ui", () => catalogPage.git().switchBranch("co-03")),
		);

		for (let i = 1; i <= BULK_COUNT; i++)
			expect(await readWorkdirFile(sharedPage, path(`${bulkArticle(i)}.md`))).toBe(`${marker} ${i}`);

		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");

		await backToMaster(catalogPage, sharedPage);
		await attachTimings(testInfo);
	});

	test("an unpublished new article follows the checkout", async ({ catalogPage, sharedPage }) => {
		const created = "---\ntitle: Fresh\n---\n\nCreated on master, never published.\n";

		await onFreshBranch(
			catalogPage,
			"co-04",
			async () => await writeWorkdirFile(sharedPage, path("fresh.md"), created),
			async () => await catalogPage.git().switchBranch("co-04"),
		);

		expect(await fileExists(sharedPage, path("fresh.md"))).toBe(true);
		expect(await readWorkdirFile(sharedPage, path("fresh.md"))).toBe(created);

		await backToMaster(catalogPage, sharedPage);
	});

	test("a deletion follows the checkout", async ({ catalogPage, sharedPage }) => {
		await onFreshBranch(
			catalogPage,
			"co-06",
			async () => await deleteWorkdirFile(sharedPage, path(`${OTHER_ARTICLE}.md`)),
			async () => await catalogPage.git().switchBranch("co-06"),
		);

		expect(await fileExists(sharedPage, path(`${OTHER_ARTICLE}.md`))).toBe(false);

		await backToMaster(catalogPage, sharedPage);
		expect(await fileExists(sharedPage, path(`${OTHER_ARTICLE}.md`))).toBe(true);
	});

	test("a rename follows the checkout", async ({ catalogPage, sharedPage }) => {
		const before = await readWorkdirFile(sharedPage, path(`${OTHER_ARTICLE}.md`));

		await onFreshBranch(
			catalogPage,
			"co-07",
			async () => await moveWorkdirFile(sharedPage, path(`${OTHER_ARTICLE}.md`), path("renamed.md")),
			async () => await catalogPage.git().switchBranch("co-07"),
		);

		expect(await fileExists(sharedPage, path(`${OTHER_ARTICLE}.md`))).toBe(false);
		expect(await readWorkdirFile(sharedPage, path("renamed.md"))).toBe(before);

		await backToMaster(catalogPage, sharedPage);
	});

	test("an edit, a new file and a deletion travel together", async ({ catalogPage, sharedPage }) => {
		const edited = "Edited as part of a mixed change";
		const created = "---\ntitle: Mixed\n---\n\nCreated as part of a mixed change.\n";

		await onFreshBranch(
			catalogPage,
			"co-08",
			async () => {
				await writeWorkdirFile(sharedPage, path("test.md"), edited);
				await writeWorkdirFile(sharedPage, path("mixed.md"), created);
				await deleteWorkdirFile(sharedPage, path(`${bulkArticle(1)}.md`));
			},
			async () => await catalogPage.git().switchBranch("co-08"),
		);

		expect(await readWorkdirFile(sharedPage, path("test.md"))).toBe(edited);
		expect(await readWorkdirFile(sharedPage, path("mixed.md"))).toBe(created);
		expect(await fileExists(sharedPage, path(`${bulkArticle(1)}.md`))).toBe(false);

		await backToMaster(catalogPage, sharedPage);
	});

	test("a changed binary resource survives the checkout byte for byte", async ({ catalogPage, sharedPage }) => {
		// A PNG with one byte of pixel data flipped: still a valid file, and different from the seed.
		const changed = [...RESOURCE_BYTES];
		changed[changed.length - 6] = (changed[changed.length - 6]! + 1) % 256;

		await onFreshBranch(
			catalogPage,
			"co-09",
			async () => await writeWorkdirBytes(sharedPage, path(RESOURCE_FILE), changed),
			async () => await catalogPage.git().switchBranch("co-09"),
		);

		expect(await readWorkdirBytes(sharedPage, path(RESOURCE_FILE))).toEqual(changed);

		await backToMaster(catalogPage, sharedPage);
	});

	// Last, because the ignored file it leaves behind is the one thing here that outlives its
	// own case: nothing tracked ever removes it.
	test("an ignored file is untouched by a checkout that stashes", async ({ catalogPage, sharedPage }) => {
		const edited = "Edited while an ignored file sat next to it";

		await onFreshBranch(
			catalogPage,
			"co-05",
			async () => {
				await writeWorkdirFile(sharedPage, path(IGNORED_FILE), IGNORED_CONTENT);
				await writeWorkdirFile(sharedPage, path("test.md"), edited);
			},
			async () => await catalogPage.git().switchBranch("co-05"),
		);

		// Checkout never resets hard, so the ignored file has no reason to move — this is the control
		// the failed-pull case is measured against.
		expect(await fileExists(sharedPage, path(IGNORED_FILE))).toBe(true);
		expect(await readWorkdirFile(sharedPage, path(IGNORED_FILE))).toBe(IGNORED_CONTENT);
		expect(await readWorkdirFile(sharedPage, path("test.md"))).toBe(edited);

		// Whether the file also sits in the index cannot be asserted here, and the attempt is worth
		// leaving described rather than repeated: `_gitIndexAddFiles` does call `index.add_path`, which
		// ignores `.gitignore` (`crates/git/src/actions/add.rs:106`), but every status query runs with
		// `include_ignored(false)` (`crates/git/src/actions/status.rs:119`), so an ignored entry can
		// never show up in `getChanges`. The observable outcome above is the whole of what a test can
		// say here.

		await backToMaster(catalogPage, sharedPage);
	});
});
