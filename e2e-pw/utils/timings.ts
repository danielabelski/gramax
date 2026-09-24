import { expect, type TestInfo } from "@playwright/test";
import { appendFileSync, mkdirSync } from "fs";
import { dirname, join, relative } from "path";
import { runId } from "./gitlab";

/**
 * A stopwatch held outside the browser.
 *
 * It measures wall clock around an awaited block on the Node side: the CDP round trip, the JS in the
 * page, the wasm backend behind it and the network to GitLab, all as one number. It does not see
 * Rust spans, fs-call counts or the split between waiting on the network and computing — read it as
 * "how long did this take from where a user stands", never as a profile.
 *
 * Which means: wrap the narrowest thing that still means something, ideally a single `page.evaluate`
 * calling one command. `waitForLoad` sleeps for over a second by design; anything measured with it
 * inside reports that sleep as if it were work.
 */
export type TimingRecord = {
	runId: string;
	project: string;
	file: string;
	test: string;
	section: string;
	ms: number;
	ok: boolean;
	attrs?: Record<string, string | number>;
	startedAt: string;
};

export type TimingAttrs = Record<string, string | number>;

/**
 * Where the aggregator looks. Deliberately *not* under `report/`: that is the config's `outputDir`,
 * and Playwright empties it at the start of every run — timings written there vanish the moment the
 * next run begins, which is exactly when a second sample was about to become useful.
 */
export const TIMINGS_DIR = join(import.meta.dirname, "..", "timings");

/**
 * One file per run per worker.
 *
 * Per worker, because four workers appending to a shared file would rest on O_APPEND staying atomic
 * for every line on every platform — splitting removes the question instead of betting on the
 * answer. Per run, because a claim about cost needs several runs behind it (see the plan's §4), and
 * runs have to accumulate side by side rather than overwrite each other.
 */
const timingsFile = (workerIndex: number): string => join(TIMINGS_DIR, runId(), `w${workerIndex}.ndjson`);

/** Records of the tests this worker process has run, so `attachTimings` has something to attach. */
const collected = new Map<string, TimingRecord[]>();

const record = (testInfo: TestInfo, entry: TimingRecord): void => {
	const file = timingsFile(testInfo.workerIndex);
	mkdirSync(dirname(file), { recursive: true });
	appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");

	collected.set(testInfo.testId, [...(collected.get(testInfo.testId) ?? []), entry]);
};

/**
 * Measures one section and returns whatever `fn` returned.
 *
 * A throwing section is recorded too, with `ok: false`, and the error is rethrown untouched — a
 * failed operation still has a duration, and that duration is usually the interesting one.
 *
 * `attrs` may be a function, evaluated after the clock stops. Anything describing what the section
 * did — a span report, a count read afterwards — is only knowable then, and gathering it inside
 * `fn` just to pass a plain object would bill its own cost to the measurement.
 */
export const measure = async <T>(
	testInfo: TestInfo,
	section: string,
	fn: () => Promise<T>,
	attrs?: TimingAttrs | (() => TimingAttrs | Promise<TimingAttrs>),
): Promise<T> => {
	const startedAt = new Date();
	const start = performance.now();

	let ok = true;
	try {
		return await fn();
	} catch (e) {
		ok = false;
		throw e;
	} finally {
		// Stopped before `attrs()` runs: gathering the description of a section must not be billed to it.
		const ms = Math.round((performance.now() - start) * 100) / 100;
		record(testInfo, {
			attrs: typeof attrs === "function" ? await attrs() : attrs,
			file: relative(join(import.meta.dirname, ".."), testInfo.file),
			ms,
			ok,
			project: testInfo.project.name,
			runId: runId(),
			section,
			startedAt: startedAt.toISOString(),
			test: testInfo.titlePath.slice(1).join(" > "),
		});
	}
};

/**
 * Fails the test if a section cost more than it is allowed to.
 *
 * The point of a budget is to notice a regression here rather than in a complaint, so it is set just
 * above what the same suite measures today — close enough to catch a change that doubles a command,
 * loose enough not to redden a pipeline over the noise of a shared runner.
 *
 * Sections without a budget are recorded and not judged. Call before `attachTimings`, which clears
 * what was collected.
 */
export const expectWithinBudget = (testInfo: TestInfo, budgets: Record<string, number>): void => {
	for (const entry of collected.get(testInfo.testId) ?? []) {
		const budget = budgets[entry.section];
		// A section with no budget, or one not set yet, is recorded and not judged.
		if (!budget) continue;

		expect(entry.ms, `section "${entry.section}" took ${entry.ms} ms, budget is ${budget} ms`).toBeLessThanOrEqual(
			budget,
		);
	}
};

/**
 * Attaches this test's timings to the Playwright report.
 *
 * The NDJSON files are the primary output — the `list` reporter prints no attachments at all. This
 * is for the trace and for whoever switches the reporter later; it costs nothing to keep in step.
 */
export const attachTimings = async (testInfo: TestInfo): Promise<void> => {
	const records = collected.get(testInfo.testId);
	collected.delete(testInfo.testId);
	if (!records?.length) return;

	await testInfo.attach("timings", {
		body: JSON.stringify(records, null, 2),
		contentType: "application/json",
	});
};
