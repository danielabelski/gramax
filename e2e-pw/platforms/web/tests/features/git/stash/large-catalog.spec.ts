import { expect, type Page, type TestInfo } from "@playwright/test";
import { commitToRemote, createProject, deleteProject, nextTempRepoName, seedLargeCatalog } from "@utils/gitlab";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { beginSpanCapture, endSpanCapture, type SpanReport, setSpanLevel } from "@utils/spans";
import { attachTimings, measure, type TimingAttrs } from "@utils/timings";
import { env } from "@utils/utils";
import { catalogTest as test } from "@web/fixtures/catalog.fixture";
import { ClonePom } from "@web/pom/clone.pom";
import { listRepoStashes, readIndexChanges, readRepoState, readWorkdirFile, writeWorkdirFile } from "./stash-helpers";

const source = getSourceDataFromEnv();
const repo = getTestRepoInfoFromEnv();

test.use({ isolated: false, source: "env", startUrl: "/" });
test.describe.configure({ mode: "serial" });

/**
 * Catalog sizes to measure, comma-separated.
 *
 * The claim this file exists to settle — that a stash costs per operation rather than per file — is
 * a statement about a curve, so one size cannot answer it and the sizes have to be a knob: small
 * enough to run locally, large enough in CI to reach the 3393-file catalog the epic is about.
 */
const DEFAULT_SIZES = "100,500,2000";

const sizes = (env.optional("GX_E2E_STASH_SIZES") ?? DEFAULT_SIZES)
	.split(",")
	.map((part) => Number(part.trim()))
	.filter((size) => Number.isInteger(size) && size > 0);

/**
 * The one article every case dirties.
 *
 * Written through the seed's `extra` rather than picked out of the generated set, so the spec does
 * not depend on how `seedLargeCatalog` lays its folders out.
 */
const EDITED_ARTICLE = "docs/edited.md";
const EDITED_TEXT = "Edited locally and never published";

/**
 * A second article, changed on the remote while the clone is not looking.
 *
 * Without something to pull, `storage/sync` returns straight after the fetch
 * (`app/commands/storage/sync.ts:36`) — no stash, no merge, nothing to measure. The case would
 * still be green: the edit survives because nothing touched it.
 */
const INCOMING_ARTICLE = "docs/incoming.md";

/** Cloning thousands of files over a real network is the slowest thing here, and it is not measured. */
const CLONE_TIMEOUT = 600_000;

/** Names as the wasm side emits them, `git::<fn>` (`crates/opentelemetry/src/lib.rs:126`). */
const TRACKED_SPANS = ["git::stash", "git::stash_apply"];

/**
 * Variants whose argument decides which code path ran, and therefore what the number means.
 *
 * `git::status#index=false` is a full working-copy walk — the one call whose cost is expected to
 * follow the catalog size — while `git::add#force=true` is what feeds the index the stash is taken
 * from. Both are named up front so they get a key in every record, zero included: a command that
 * never ran and a command that cost nothing must stay tellable apart across the sizes.
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

	// The flat attrs keep only what a curve needs; the whole report is attached so the tail of
	// `slowest` and the names nobody thought to track survive the run.
	await testInfo.attach(`spans-${section}`, {
		body: JSON.stringify(report, null, 2),
		contentType: "application/json",
	});

	// Handed back so a case can refuse a measurement of nothing.
	return report;
};

test.describe("stash on a large catalog", () => {
	// Seeding thousands of articles and cloning them back is minutes of setup per size, none of it
	// measured — the sections are timed by their own clock, not by the budget of the test.
	test.slow();

	for (const size of sizes) {
		test(`sync stashes one edit in a catalog of ${size}`, async ({ catalogPage, sharedPage }, testInfo) => {
			const name = nextTempRepoName(testInfo.workerIndex);
			const project = await createProject(name);

			try {
				// The catalog title doubles as the card to click, so it has to be unique per size — the
				// sizes share one workspace, and three cards under the same title cannot be told apart.
				await seedLargeCatalog(project.id, size, {
					".doc-root.yaml": `title: ${name}\n`,
					[EDITED_ARTICLE]: "---\ntitle: Edited\n---\n\nSeeded article the case dirties.\n",
					[INCOMING_ARTICLE]: "---\ntitle: Incoming\n---\n\nSeeded article the remote will change.\n",
				});

				const clone = new ClonePom(catalogPage);
				await clone.cloneCatalog({ group: repo.tempGroup, repo: name, storage: source.domain });
				await clone.openCatalog(name, CLONE_TIMEOUT);

				// After the last navigation: the level lives in memory on both sides, so any `goto`
				// before the measured block would drop it back to the stored default.
				// A level that failed to arm produces a green run with no git spans in it — the most
				// expensive kind of blank, because it looks like an answer.
				expect(await setSpanLevel(sharedPage, "internal")).toBe(true);

				await commitToRemote(
					project.id,
					[
						{
							action: "update",
							content: "---\ntitle: Incoming\n---\n\nChanged on the remote after the clone.\n",
							filePath: INCOMING_ARTICLE,
						},
					],
					"e2e: incoming change for the size sweep",
				);

				const article = `${name}/${EDITED_ARTICLE}`;
				await writeWorkdirFile(sharedPage, article, EDITED_TEXT);

				// On web nothing calls `gvc.add()` before stashing, so an empty index here would mean no
				// stash at all — the case would still produce a number, of the wrong thing.
				expect(await readIndexChanges(sharedPage, name)).toContainEqual(expect.stringContaining("edited.md"));

				const report = await measureWithSpans(
					sharedPage,
					testInfo,
					`stash-size-${size}`,
					() => catalogPage.git().sync(),
					{ catalogFiles: size, dirtyFiles: 1 },
				);

				// The measurement is only worth something if the operation happened. A sync with nothing
				// to pull returns after the fetch, leaving every assertion below true and every number
				// zero — a blank that reads exactly like an answer.
				expect(report.byName["git::stash"]?.n).toBe(1);
				await catalogPage.waitForLoad();

				// The edit came back, and nothing was left behind to restore a second time on the next
				// load. A duration measured over a stash that ate the edit is worth nothing.
				// Contains, not equals: an article saved without frontmatter comes back with an empty one
				// (`---\n{}\n---`) — Gramax normalises it, and that is not the stash losing anything.
				expect(await readWorkdirFile(sharedPage, article)).toContain(EDITED_TEXT);
				expect(await listRepoStashes(sharedPage, name)).toEqual([]);
				expect((await readRepoState(sharedPage, name)).value).toBe("default");

				await attachTimings(testInfo);
			} finally {
				// Best effort: a teardown that throws fails the run, and losing a throwaway repo is not
				// a test result. The scheduled `e2e-temp-cleanup` sweeps whatever is left behind.
				try {
					await deleteProject(project.id);
				} catch (e) {
					console.warn(`large catalog teardown: cannot delete ${name}: ${String(e)}`);
				}
			}
		});
	}
});
