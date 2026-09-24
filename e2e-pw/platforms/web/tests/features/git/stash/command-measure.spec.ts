import { expect, type Page, type TestInfo } from "@playwright/test";
import {
	commitToRemote,
	countRemoteFiles,
	createProject,
	deleteProject,
	forkProject,
	nextTempRepoName,
	readRemoteFile,
	remoteFileExists,
	seedLargeCatalog,
} from "@utils/gitlab";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { beginSpanCapture, endSpanCapture, recentSpans, type SpanReport, setSpanLevel } from "@utils/spans";
import { attachTimings, expectWithinBudget, measure, type TimingAttrs } from "@utils/timings";
import { env } from "@utils/utils";
import { catalogTest as test } from "@web/fixtures/catalog.fixture";
import { publishCatalog } from "@web/fixtures/git.fixture";
import { ClonePom } from "@web/pom/clone.pom";
import {
	discardAllChanges,
	listRepoStashes,
	listStashOids,
	readIndexChanges,
	readRepoState,
	readWorkdirFile,
	writeWorkdirFile,
} from "./stash-helpers";

const source = getSourceDataFromEnv();
const repo = getTestRepoInfoFromEnv();

test.use({ isolated: false, source: "env", startUrl: "/" });
test.describe.configure({ mode: "serial" });

/**
 * How many articles the catalog carries.
 *
 * A knob rather than a constant: the same four commands have to be measurable on a laptop-sized
 * catalog and on one the size of the customer catalogs this epic is about, and the numbers only mean
 * anything next to the size they were taken at — which is why `catalogFiles` rides in every record.
 */
const DEFAULT_SIZE = 500;

const requested = Number(env.optional("GX_E2E_CMD_SIZE") ?? DEFAULT_SIZE);
const SIZE = Number.isInteger(requested) && requested > 0 ? requested : DEFAULT_SIZE;

/**
 * A fixture catalog to measure instead of a generated one, as `group/path`.
 *
 * Generated catalogs are uniform: same file size, same depth, one commit. A real catalog is not, and
 * the numbers this epic argues about come from one — so the fixture is a snapshot of the real board,
 * 3446 files, kept in the read-only group and never written to.
 *
 * It is forked per run rather than used directly. The sections publish, sync and branch as they go,
 * and a shared repository would drift with every run: the fixture would stop being the same catalog,
 * and the budgets below would be measuring a moving target. The fork is thrown away with the run.
 */
const FIXTURE_REPO = env.optional("GX_E2E_CMD_FIXTURE");

/** Where a catalog keeps its title, which is what the card in the list is found by. */
const DOC_ROOT = ".doc-root.yaml";

/**
 * What each command may cost before this is a regression, in milliseconds.
 *
 * Taken from a run of this job on a CI runner against the fixture, raised by half, and then by a
 * further 30% (rounded up to 50 ms) after the first honest red: on !3707 `publish` measured 4420 ms
 * against 3650 and `checkout` 2410 ms against 2400, with nothing in the diff that touches git. Half
 * turned out to be less room than a shared runner's bad minute takes; the pair still catches the
 * kind of change this epic spent its time removing — a command that doubles.
 *
 * The first honest red is more likely to mean the budget was tight than that something broke: raise
 * it and say so in the commit, rather than re-running until it passes.
 *
 * Which is also why this case no longer gates the MR pipeline: raising a wall-clock budget until a
 * loaded runner stops tripping it raises it past the regressions it was meant to catch. It runs in
 * `web-stash-timings` — the manual `web-e2e-pw-timings` job — where nothing else on the node is
 * competing for the same minutes and a red is worth reading.
 *
 * They hold for the catalog CI measures — the fixture named by `GX_E2E_CMD_FIXTURE`, which is the
 * same 3446 files every run. A generated catalog of some other size is a different budget, and says
 * so by not being judged.
 *
 * Judged per test, not from the run's summary: `sync-clean` and `sync-dirty` are also section names
 * in the correctness specs, on a catalog of a dozen files, and the summary adds the two together.
 */
const BUDGET_MS: Record<string, number> = {
	checkout: 3150,
	publish: 4750,
	"publish-cold": 4750,
	"sync-clean": 10700,
	"sync-dirty": 12100,
};

/**
 * The one article every section dirties.
 *
 * Written through the seed's `extra` rather than picked out of the generated set, so the spec does
 * not depend on how `seedLargeCatalog` lays its folders out.
 */
const EDITED_ARTICLE = "docs/edited.md";

/**
 * A second article, changed on the remote while the clone is not looking.
 *
 * Without something to pull, `storage/sync` returns straight after the fetch
 * (`app/commands/storage/sync.ts:36`) — no merge, no stash, nothing to measure. The section would
 * still be green, and its number would be the cost of a fetch.
 */
const INCOMING_ARTICLE = "docs/incoming.md";

const PUBLISHED_TEXT = "Edited locally and published by the publish section";
const COLD_TEXT = "Edited and published in a session that did not clone the catalog";
const DIRTY_TEXT = "Edited locally and never published";
const CHECKOUT_TEXT = "Edited on master, carried onto the bench branch";
const INCOMING_CLEAN_TEXT = "Incoming while nothing was changed locally";
const INCOMING_DIRTY_TEXT = "Incoming alongside an unpublished local edit";

/**
 * The branch the checkout section switches onto. Made inside the section, off the state it measures.
 *
 * Whatever is measured — a generated catalog or a fork of the fixture — is born and deleted inside
 * one run, so a fixed name is enough.
 */
const BENCH_BRANCH = "bench-checkout";

/** Cloning thousands of files over a real network is the slowest thing here, and it is not measured. */
const CLONE_TIMEOUT = 600_000;

/**
 * Names as the wasm side emits them, `git::<fn>` (`crates/opentelemetry/src/lib.rs:126`).
 *
 * Every one gets a key in the record even when it never ran, so a reader can tell a command that
 * cost nothing from a command that was never called — `sync-clean` is read as a zero on `git::stash`.
 */
const TRACKED_SPANS = [
	"git::add",
	"git::checkout",
	"git::commit",
	"git::fetch",
	"git::merge",
	"git::push",
	"git::stash",
	"git::stash_apply",
	"git::status",
];

/**
 * Variants whose argument decides which code path ran, and therefore what the number means.
 *
 * `git::status#index=false` is a full working-copy walk — the one call whose cost is expected to
 * follow the catalog size — while `git::add#force=true` is what feeds the index a publish commits and
 * a stash is taken from. Both are named up front so they get a key in every record, zero included.
 */
const TRACKED_VARIANTS = ["git::status#index=false", "git::add#force=true"];

const round = (ms: number) => Math.round(ms * 100) / 100;

/** The span report as flat keys, because `TimingAttrs` is `Record<string, string | number>`. */
const spanAttrs = (report: SpanReport): TimingAttrs => {
	const attrs: TimingAttrs = { spanTotal: report.total };

	for (const name of TRACKED_SPANS) {
		const stat = report.byName[name];
		attrs[`${name}.n`] = stat?.n ?? 0;
		attrs[`${name}.totalMs`] = round(stat?.totalMs ?? 0);
	}

	for (const key of TRACKED_VARIANTS) {
		const stat = report.byVariant[key];
		attrs[`${key}.n`] = stat?.n ?? 0;
		attrs[`${key}.totalMs`] = round(stat?.totalMs ?? 0);
	}

	return attrs;
};

/**
 * Runs one operation with the clock and the spans around it.
 *
 * The span report is collected after the clock stops and handed to `measure` as a thunk, so the
 * flush and the IndexedDB read it costs are not billed to the operation.
 */
const measureWithSpans = async (
	page: Page,
	testInfo: TestInfo,
	section: string,
	fn: () => Promise<void>,
	extra: TimingAttrs = {},
): Promise<SpanReport> => {
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

	// Handed back so a section can refuse a measurement of nothing.
	return report;
};

test.describe("command measurement on a large catalog", () => {
	// Seeding hundreds of articles and cloning them back is minutes of setup, none of it measured —
	// the sections are timed by their own clock, not by the budget of the test.
	test.slow();

	// A real catalog is thousands of files, and cloning it into OPFS is the slowest part of the run
	// by a wide margin. It is setup, not measurement, but it still has to fit inside the test.
	if (FIXTURE_REPO) test.setTimeout(45 * 60_000);

	// One repository for all four sections, in this order: publishing gives the clone a commit of its
	// own, the two syncs run against what the publish left, and the checkout branches off that. Clone
	// is deliberately absent from the numbers — it is a download plus a checkout, so it would report
	// the network rather than the local work this epic is about.
	test(`publish, sync and checkout on a catalog of ${SIZE}`, async ({ catalogPage, sharedPage }, testInfo) => {
		const name = nextTempRepoName(testInfo.workerIndex);
		const project = FIXTURE_REPO ? await forkProject(FIXTURE_REPO, name) : await createProject(name);

		/** Working-copy paths are catalog-relative; the catalog directory is named after the repo. */
		const inCatalog = (file: string) => `${name}/${file}`;

		try {
			// The catalog title doubles as the card to click, so it carries the repo name — the workspace
			// is shared with whatever else the worker cloned, and two cards under one title are not
			// tellable apart.
			if (FIXTURE_REPO) {
				// The fork carries the fixture's own title, and the card is found by title — so it is
				// renamed to the fork. Only that line: the rest of the file is the catalog's settings, and
				// a catalog configured differently is a different measurement.
				const docRoot = (await readRemoteFile(project.id, DOC_ROOT)).replace(/^title:.*$/m, `title: ${name}`);

				// The two articles the sections work on have to exist; everything else is whatever the
				// fixture holds. Both may already be there — the fixture is a real catalog — so the action
				// is chosen per file.
				await commitToRemote(
					project.id,
					[
						{ action: "update", content: docRoot, filePath: DOC_ROOT },
						{
							action: (await remoteFileExists(project.id, EDITED_ARTICLE)) ? "update" : "create",
							content: "---\ntitle: Edited\n---\n\nArticle every section dirties.\n",
							filePath: EDITED_ARTICLE,
						},
						{
							action: (await remoteFileExists(project.id, INCOMING_ARTICLE)) ? "update" : "create",
							content: "---\ntitle: Incoming\n---\n\nArticle the remote will change.\n",
							filePath: INCOMING_ARTICLE,
						},
					],
					"e2e: articles for the measurement",
				);
			} else {
				await seedLargeCatalog(project.id, SIZE, {
					".doc-root.yaml": `title: ${name}\n`,
					[EDITED_ARTICLE]: "---\ntitle: Edited\n---\n\nSeeded article every section dirties.\n",
					[INCOMING_ARTICLE]: "---\ntitle: Incoming\n---\n\nSeeded article the remote will change.\n",
				});
			}

			// Counted rather than assumed: for a real catalog the size knob describes a catalog that was
			// never seeded, and a record that misreports its own size is worse than one without it.
			const catalogFiles = await countRemoteFiles(project.id);

			const clone = new ClonePom(catalogPage);
			await clone.cloneCatalog({ group: repo.tempGroup, repo: name, storage: source.domain });
			await clone.openCatalog(name, CLONE_TIMEOUT);

			const git = catalogPage.git();

			// Opening the catalog is a click plus however long the app needs to render it, and on a real
			// catalog those are minutes apart. The git controls are the view's own readiness signal:
			// waiting for them here means a control missing later is a regression rather than a boot
			// that had not finished.
			try {
				await expect(git.syncTrigger).toBeVisible({ timeout: CLONE_TIMEOUT });
			} catch (error) {
				// The controls never came. What the app was doing meanwhile is in its own spans, and they
				// outlive the failure — printing them here is the difference between "the button is
				// missing" and a named operation that hung or threw.
				console.log(`catalog never opened; url ${sharedPage.url()}`);
				console.log(JSON.stringify(await recentSpans(sharedPage, 40), null, 1));
				throw error;
			}

			// ---- publish -------------------------------------------------------------------------
			await writeWorkdirFile(sharedPage, inCatalog(EDITED_ARTICLE), PUBLISHED_TEXT);

			// On web nothing calls `gvc.add()` before committing, so an empty index here would mean a
			// publish with nothing in it — a duration over an operation that no-opped.
			expect(await readIndexChanges(sharedPage, name)).toContainEqual(expect.stringContaining("edited.md"));

			// After the last navigation of the section: the level lives in memory on both sides, so any
			// navigation before the measured block drops it back to the stored default. A level that
			// failed to arm produces a green run with no git spans in it — the most expensive kind of
			// blank, because it reads exactly like an answer.
			expect(await setSpanLevel(sharedPage, "internal")).toBe(true);

			// Published through the command rather than the panel. A write straight to disk reaches git
			// without the publish panel ever hearing of it — the panel is fed by the UI's own index
			// service — so the button would never enable. Calling the command is also the narrowest
			// block worth timing: the panel's own rendering is not what this epic is about.
			const publishReport = await measureWithSpans(
				sharedPage,
				testInfo,
				"publish",
				() => publishCatalog(sharedPage, { catalogName: name, message: "e2e: publish measurement" }),
				{ catalogFiles, dirtyFiles: 1 },
			);

			expect(publishReport.total).toBeGreaterThan(0);

			// The commit is not the point — the push is. The remote holding the new text is the only
			// proof the whole command ran, and "No changes" the proof nothing was left behind.
			expect(await readRemoteFile(project.id, EDITED_ARTICLE)).toContain(PUBLISHED_TEXT);
			await git.closePublish();

			// ---- publish-cold --------------------------------------------------------------------
			// The same publish, but in a session that did not clone the catalog.
			//
			// WASMFS hands out a fresh inode and mtime for every file the first time a page touches it:
			// the inode is a pointer into memory, the mtime is when the object was constructed. Neither
			// survives a reload, so after one no `lstat` matches what the index recorded and git falls
			// back to reading and hashing whatever it walks. Every section above runs in the session that
			// cloned the catalog, where the stat cache is as warm as it will ever be — which is the one
			// state a user is never in.
			await sharedPage.reload();
			await catalogPage.waitForLoad();

			await writeWorkdirFile(sharedPage, inCatalog(EDITED_ARTICLE), COLD_TEXT);
			expect(await readIndexChanges(sharedPage, name)).toContainEqual(expect.stringContaining("edited.md"));

			expect(await setSpanLevel(sharedPage, "internal")).toBe(true);

			const coldReport = await measureWithSpans(
				sharedPage,
				testInfo,
				"publish-cold",
				() => publishCatalog(sharedPage, { catalogName: name, message: "e2e: publish measurement (cold)" }),
				{ catalogFiles, dirtyFiles: 1 },
			);

			expect(coldReport.total).toBeGreaterThan(0);
			expect(await readRemoteFile(project.id, EDITED_ARTICLE)).toContain(COLD_TEXT);
			await git.closePublish();

			// ---- sync-clean ----------------------------------------------------------------------
			const stashesBeforeClean = await listStashOids(sharedPage, name);

			await commitToRemote(
				project.id,
				[
					{
						action: "update",
						content: `---\ntitle: Incoming\n---\n\n${INCOMING_CLEAN_TEXT}\n`,
						filePath: INCOMING_ARTICLE,
					},
				],
				"e2e: incoming change for sync-clean",
			);

			expect(await setSpanLevel(sharedPage, "internal")).toBe(true);

			await measureWithSpans(sharedPage, testInfo, "sync-clean", () => git.sync(), {
				catalogFiles,
				dirtyFiles: 0,
			});
			await catalogPage.waitForLoad();

			// The incoming file arrived, so the sync pulled and merged rather than returning after the
			// fetch. No stash was taken — the baseline `sync-dirty` is read against.
			expect(await readWorkdirFile(sharedPage, inCatalog(INCOMING_ARTICLE))).toContain(INCOMING_CLEAN_TEXT);
			expect(await listStashOids(sharedPage, name)).toEqual(stashesBeforeClean);
			expect((await readRepoState(sharedPage, name)).value).toBe("default");

			// ---- sync-dirty ----------------------------------------------------------------------
			await writeWorkdirFile(sharedPage, inCatalog(EDITED_ARTICLE), DIRTY_TEXT);
			expect(await readIndexChanges(sharedPage, name)).toContainEqual(expect.stringContaining("edited.md"));

			await commitToRemote(
				project.id,
				[
					{
						action: "update",
						content: `---\ntitle: Incoming\n---\n\n${INCOMING_DIRTY_TEXT}\n`,
						filePath: INCOMING_ARTICLE,
					},
				],
				"e2e: incoming change for sync-dirty",
			);

			// The sync above reloaded the SPA, so the level has to be armed again.
			expect(await setSpanLevel(sharedPage, "internal")).toBe(true);

			const syncDirtyReport = await measureWithSpans(sharedPage, testInfo, "sync-dirty", () => git.sync(), {
				catalogFiles,
				dirtyFiles: 1,
			});

			// Exactly one stash: this section exists to price the stash, and a sync that skipped it
			// measures `sync-clean` twice.
			expect(syncDirtyReport.byName["git::stash"]?.n).toBe(1);
			await catalogPage.waitForLoad();

			// The local edit survived and the incoming change landed on top of it. Contains, not equals:
			// an article saved without frontmatter comes back with an empty one (`---\n{}\n---`) —
			// Gramax normalises it, and that is not the stash losing anything.
			expect(await readWorkdirFile(sharedPage, inCatalog(EDITED_ARTICLE))).toContain(DIRTY_TEXT);
			expect(await readWorkdirFile(sharedPage, inCatalog(INCOMING_ARTICLE))).toContain(INCOMING_DIRTY_TEXT);

			// Nothing left behind to restore a second time on the next load.
			expect(await listRepoStashes(sharedPage, name)).toEqual([]);
			expect((await readRepoState(sharedPage, name)).value).toBe("default");

			// ---- checkout ------------------------------------------------------------------------
			// The checkout section starts from the branch as published, so the edit it carries is its
			// own and the stash it pays for holds one file.
			await discardAllChanges(sharedPage, name);

			// Making the branch first and coming back to master is what puts the edit in front of the
			// checkout rather than behind it.
			await git.createBranch(BENCH_BRANCH);
			await git.switchBranch("master");

			await writeWorkdirFile(sharedPage, inCatalog(EDITED_ARTICLE), CHECKOUT_TEXT);
			expect(await readIndexChanges(sharedPage, name)).toContainEqual(expect.stringContaining("edited.md"));

			// Both checkouts above navigate, so this is the last chance to arm the level.
			expect(await setSpanLevel(sharedPage, "internal")).toBe(true);

			// The branch list is opened outside the measured block: `switchBranch` opens it itself, and
			// the panel mounting is not part of a checkout.
			await git.openBranches();

			const checkoutReport = await measureWithSpans(
				sharedPage,
				testInfo,
				"checkout",
				() => git.switchBranch(BENCH_BRANCH),
				{ catalogFiles, dirtyFiles: 1 },
			);

			expect(checkoutReport.total).toBeGreaterThan(0);

			// The branch changed and the edit came across with it — a checkout that stayed put or ate
			// the edit is not what the number above is supposed to price.
			await git.assertCurrentBranch(BENCH_BRANCH);
			expect(await readWorkdirFile(sharedPage, inCatalog(EDITED_ARTICLE))).toContain(CHECKOUT_TEXT);
			expect(await listRepoStashes(sharedPage, name)).toEqual([]);
			expect((await readRepoState(sharedPage, name)).value).toBe("default");

			// Judged before the records are attached: attaching clears them. Only the fixture is judged —
			// it is the catalog the budgets were measured on; any other size is measured and left alone.
			if (FIXTURE_REPO) expectWithinBudget(testInfo, BUDGET_MS);

			await attachTimings(testInfo);
		} finally {
			// Everything measured belongs to this run — a generated catalog or a fork of the fixture — so
			// it goes. Best effort: a teardown that throws fails the run, and losing a throwaway repo is
			// not a test result. The scheduled `e2e-temp-cleanup` sweeps whatever is left behind.
			try {
				await deleteProject(project.id);
			} catch (e) {
				console.warn(`command measurement teardown: cannot delete ${name}: ${String(e)}`);
			}
		}
	});
});
