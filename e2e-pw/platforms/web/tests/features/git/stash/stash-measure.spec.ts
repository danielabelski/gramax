import { expect, type Page, type TestInfo } from "@playwright/test";
import { commitToRemote, type GitlabProject } from "@utils/gitlab";
import { beginSpanCapture, endSpanCapture, type SpanReport, setSpanLevel } from "@utils/spans";
import { attachTimings, measure, type TimingAttrs } from "@utils/timings";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { remoteCatalogUrl } from "../catalog-setup";
import {
	discardAllChanges,
	listRepoStashes,
	listStashOids,
	readIndexChanges,
	readRepoState,
	readWorkdirFile,
	writeWorkdirFile,
} from "./stash-helpers";
import { bulkArticle, OTHER_ARTICLE, prepareStashCatalog } from "./stash-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

/** How many articles the scaling case dirties; the catalog is seeded with exactly this many. */
const BULK_COUNT = 10;

/** The branch the checkout case switches onto. Made inside that case, off the state it measures. */
const BENCH_BRANCH = "bench-checkout";

/**
 * The commands this epic is about, as the wasm side names them: `git::<fn>` (`target::name`,
 * `crates/opentelemetry/src/lib.rs:126`).
 *
 * Every one gets a key in the record even when it never ran, so a reader can tell a command that
 * cost nothing from a command that was never called — the point of `sync-clean` is a zero here.
 */
const TRACKED_SPANS = ["git::checkout", "git::merge", "git::stash", "git::stash_apply", "git::status"];

let catalogName: string;
let project: GitlabProject;

const path = (file: string) => `${catalogName}/${file}`;

/** Puts a commit on the remote that the app has no way of knowing about yet. */
const pushIncoming = async (article: string, body: string) =>
	await commitToRemote(
		project.id,
		[{ action: "update", content: `---\ntitle: ${article}\n---\n\n${body}\n`, filePath: `${article}.md` }],
		`e2e: incoming change to ${article}`,
	);

const round = (ms: number) => Math.round(ms * 100) / 100;

/**
 * The span report as flat keys, because `TimingAttrs` is `Record<string, string | number>`.
 *
 * `spanTotal` is what says whether the capture saw anything at all: a zero there makes every other
 * zero meaningless, and a run that captured nothing is a weaker result rather than a failure.
 */
const spanAttrs = (report: SpanReport): TimingAttrs => {
	const attrs: TimingAttrs = { spanTotal: report.total };

	for (const name of TRACKED_SPANS) {
		const stat = report.byName[name];
		attrs[`${name}.n`] = stat?.n ?? 0;
		attrs[`${name}.totalMs`] = round(stat?.totalMs ?? 0);
	}

	// Variants ride along in the record rather than only in an attachment: the `list` reporter keeps
	// attachments out of the output directory, so anything left there alone is gone once the run ends.
	// `git::status#index=false` is a full working-copy walk and `#index=true` an index comparison —
	// the one distinction the aggregate name hides, and the number a follow-up task is judged on.
	for (const [key, stat] of Object.entries(report.byVariant)) {
		attrs[`${key}.n`] = stat.n;
		attrs[`${key}.totalMs`] = round(stat.totalMs);
	}

	return attrs;
};

/**
 * Runs one operation with the clock and the spans around it.
 *
 * The span report is collected after the clock stops and handed to `measure` as a thunk, so the
 * flush and the IndexedDB read it costs are not billed to the operation. `ms` is therefore the
 * operation alone; the per-command truth is in the span attrs either way.
 *
 * The diff rests on `window.e2eSeenSpanIds`, which a hard reload would drop — a sync refreshes the
 * SPA in place, so it survives, and a `spanTotal` far larger than the operation could explain is what
 * a lost set looks like if that ever changes.
 */
const measureWithSpans = async (
	page: Page,
	testInfo: TestInfo,
	section: string,
	fn: () => Promise<void>,
	extra: TimingAttrs = {},
): Promise<void> => {
	await beginSpanCapture(page);

	let report: SpanReport = { byName: {}, byVariant: {}, slowest: [], total: 0 };

	await measure(testInfo, section, fn, async () => {
		report = await endSpanCapture(page);
		return { ...extra, ...spanAttrs(report) };
	});

	// The flat attrs keep only what an aggregate needs; the whole report is attached so the tail of
	// `slowest` and the names nobody thought to track survive the run.
	await testInfo.attach(`spans-${section}`, {
		body: JSON.stringify(report, null, 2),
		contentType: "application/json",
	});
};

/**
 * Raises the capture level for the page as it stands now.
 *
 * `internal` is what makes `git::*` spans appear; `full` is deliberately not used, because
 * `fs::disk::*` at that level emits thousands of spans per operation and would dominate both the
 * report and the cost of reading it. Called per case rather than once for the suite: the level lives
 * in memory (`globalThis.otel.logLevel`, `core/extensions/loggers/opentelemetry/index.ts:30`) and the
 * wasm worker is told its rank over `postMessage`, so every navigation drops both back to the stored
 * default — it has to be re-applied after the last `goto` and before the measured block.
 */
const armSpans = (page: Page) => setSpanLevel(page, "internal");

test.describe("stash measurement", () => {
	// The catalog carries eleven articles instead of one, and linking pushes all of them before the
	// app finishes loading the result — the setup alone outruns the project timeout. The measured
	// sections are unaffected: they are timed by their own clock, not by the budget of the test.
	test.slow();

	test("links a fresh catalog and finds the repository behind it", async ({
		catalogPage,
		sharedPage,
		tempRepoName,
	}) => {
		catalogName = tempRepoName;
		project = await prepareStashCatalog(catalogPage, sharedPage, { bulk: BULK_COUNT, name: catalogName });

		await catalogPage.git().assertCurrentBranch("master");
	});

	test("sync-clean: a pull with nothing local to stash", async ({ catalogPage, sharedPage }, testInfo) => {
		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const stashesBefore = await listStashOids(sharedPage, catalogName);
		await pushIncoming(OTHER_ARTICLE, "Incoming while nothing was changed locally");

		await armSpans(sharedPage);
		const git = catalogPage.git();
		await measureWithSpans(sharedPage, testInfo, "sync-clean", () => git.sync(), { dirtyFiles: 0 });
		await catalogPage.waitForLoad();

		expect(await readWorkdirFile(sharedPage, path(`${OTHER_ARTICLE}.md`))).toContain(
			"Incoming while nothing was changed locally",
		);

		// The baseline this whole file is read against: no stash was taken, so whatever `sync-dirty-*`
		// costs on top of this is the stash.
		expect(await listStashOids(sharedPage, catalogName)).toEqual(stashesBefore);
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");

		await attachTimings(testInfo);
	});

	test("sync-dirty-1: a pull that stashes one unpublished edit", async ({ catalogPage, sharedPage }, testInfo) => {
		const edited = "Edited locally and never published";

		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		await writeWorkdirFile(sharedPage, path("test.md"), edited);

		// On web nothing calls `gvc.add()` before stashing, so an empty index here would mean no stash
		// at all — the case would still pass a stopwatch and measure the wrong thing.
		expect(await readIndexChanges(sharedPage, catalogName)).toContainEqual(expect.stringContaining("test.md"));

		await pushIncoming(OTHER_ARTICLE, "Incoming alongside an unpublished local edit");

		await armSpans(sharedPage);
		const git = catalogPage.git();
		const stashesBefore = await listStashOids(sharedPage, catalogName);
		await measureWithSpans(sharedPage, testInfo, "sync-dirty-1", () => git.sync(), { dirtyFiles: 1 });
		await catalogPage.waitForLoad();

		expect(await readWorkdirFile(sharedPage, path("test.md"))).toContain(edited);
		expect(await readWorkdirFile(sharedPage, path(`${OTHER_ARTICLE}.md`))).toContain(
			"Incoming alongside an unpublished local edit",
		);

		// A stash was made, applied and dropped: the app logged one, the repository holds none, and the
		// state is clear again. Anything left here would be restored a second time on the next load.
		expect((await listStashOids(sharedPage, catalogName)).length).toBeGreaterThan(stashesBefore.length);
		expect(await listRepoStashes(sharedPage, catalogName)).toEqual([]);
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");

		await discardAllChanges(sharedPage, catalogName);
		await attachTimings(testInfo);
	});

	test("sync-dirty-10: a pull that stashes ten unpublished edits", async ({ catalogPage, sharedPage }, testInfo) => {
		const marker = "Edited in bulk and never published";

		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		for (let i = 1; i <= BULK_COUNT; i++)
			await writeWorkdirFile(sharedPage, path(`${bulkArticle(i)}.md`), `${marker} ${i}`);

		expect(await readIndexChanges(sharedPage, catalogName)).toEqual(
			expect.arrayContaining(
				Array.from({ length: BULK_COUNT }, (_, i) => expect.stringContaining(`${bulkArticle(i + 1)}.md`)),
			),
		);

		await pushIncoming(OTHER_ARTICLE, "Incoming alongside ten unpublished local edits");

		await armSpans(sharedPage);
		const git = catalogPage.git();
		const stashesBefore = await listStashOids(sharedPage, catalogName);
		await measureWithSpans(sharedPage, testInfo, "sync-dirty-10", () => git.sync(), { dirtyFiles: BULK_COUNT });
		await catalogPage.waitForLoad();

		for (let i = 1; i <= BULK_COUNT; i++)
			expect(await readWorkdirFile(sharedPage, path(`${bulkArticle(i)}.md`))).toBe(`${marker} ${i}`);

		expect(await readWorkdirFile(sharedPage, path(`${OTHER_ARTICLE}.md`))).toContain(
			"Incoming alongside ten unpublished local edits",
		);

		expect((await listStashOids(sharedPage, catalogName)).length).toBeGreaterThan(stashesBefore.length);
		expect(await listRepoStashes(sharedPage, catalogName)).toEqual([]);
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");

		await discardAllChanges(sharedPage, catalogName);
		await attachTimings(testInfo);
	});

	test("checkout-dirty-1: a checkout that stashes one unpublished edit", async ({
		catalogPage,
		sharedPage,
	}, testInfo) => {
		const edited = "Edited on master, carried onto the bench branch";

		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		// Making the branch first and coming back to master is what puts the edit in front of the
		// checkout rather than behind it.
		const git = catalogPage.git();
		await git.createBranch(BENCH_BRANCH);
		await git.switchBranch("master");

		await writeWorkdirFile(sharedPage, path("test.md"), edited);
		expect(await readIndexChanges(sharedPage, catalogName)).toContainEqual(expect.stringContaining("test.md"));

		await armSpans(sharedPage);
		// The branch list is opened outside the measured block: `switchBranch` opens it itself, and the
		// panel mounting is not part of a checkout.
		await git.openBranches();

		const stashesBefore = await listStashOids(sharedPage, catalogName);
		await measureWithSpans(sharedPage, testInfo, "checkout-dirty-1", () => git.switchBranch(BENCH_BRANCH), {
			dirtyFiles: 1,
		});

		expect(await readWorkdirFile(sharedPage, path("test.md"))).toBe(edited);

		expect((await listStashOids(sharedPage, catalogName)).length).toBeGreaterThan(stashesBefore.length);
		expect(await listRepoStashes(sharedPage, catalogName)).toEqual([]);
		expect((await readRepoState(sharedPage, catalogName)).value).toBe("default");

		await discardAllChanges(sharedPage, catalogName);
		await git.switchBranch("master");
		await attachTimings(testInfo);
	});
});
