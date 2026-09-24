import type { Page } from "@playwright/test";

/**
 * Capture level, shared by both filters.
 *
 * The app drops spans twice, independently: the TS exporter checks `globalThis.otel.logLevel`, the
 * Rust/wasm side checks a rank it was told over `postMessage`. Raising one and forgetting the other
 * silently loses half the picture — `setSpanLevel` raises both from a single value.
 */
export type SpanLevel = "commands" | "important" | "internal" | "files" | "full";

export type SpanStat = { n: number; totalMs: number; maxMs: number };

export type SpanReport = {
	total: number;
	byName: Record<string, SpanStat>;
	/**
	 * Counts for spans whose arguments change what the call actually does, keyed `<name>#<arg>=<value>`
	 * — `git::status#index=false` is a full working-copy walk, `git::status#index=true` is an index
	 * comparison, and lumping them together hides the only distinction that matters.
	 */
	byVariant: Record<string, SpanStat>;
	slowest: { name: string; ms: number }[];
};

/** Rust reads the level as a number; the order matches `SpanLevel` and is fixed on the Rust side. */
const LEVEL_RANK: Record<SpanLevel, number> = {
	commands: 0,
	files: 3,
	full: 4,
	important: 1,
	internal: 2,
};

/**
 * Raises both capture filters. Call once per page, before the work being measured.
 *
 * Boot default is `important`, which hides everything interesting: `git::*` needs `internal`,
 * `fs::disk::*` needs `full`. A page where otel is not wired yet is a no-op, never a failure — a
 * measurement that captured nothing is a weaker result, not a broken test.
 */
export const setSpanLevel = async (page: Page, level: SpanLevel, timeoutMs = 30_000): Promise<boolean> => {
	// The wasm side answers only by throwing. `postMessage` is one-way, so a worker that cannot raise
	// the level — the export missing from the emscripten list, say — reports it as a page error long
	// after the post returned. Without this listener such a run reads as armed and produces spans
	// without a single git call in them.
	const failures: string[] = [];
	const onPageError = (error: Error) => {
		if (error.message.includes("otel_set_level")) failures.push(error.message);
	};

	page.on("pageerror", onPageError);

	try {
		const armed = await setLevelInPage(page, level, timeoutMs);
		if (!armed) return false;

		// The throw crosses back from the worker after the post resolves, so it arrives a tick later.
		await page.waitForTimeout(250);
		return failures.length === 0;
	} finally {
		page.off("pageerror", onPageError);
	}
};

const setLevelInPage = async (page: Page, level: SpanLevel, timeoutMs: number): Promise<boolean> => {
	return await page.evaluate(
		async ({ level, rank, timeoutMs }) => {
			// Both sides have to exist before either can be told anything, and after a navigation they
			// appear late — the app boots the worker and registers otel asynchronously. Setting the level
			// against a half-booted page is a silent no-op that costs a whole measurement: the run stays
			// green, the spans simply never mention git. Waiting is the difference between a number and
			// a blank.
			const deadline = Date.now() + timeoutMs;
			const ready = () => {
				const otel = (globalThis as unknown as { otel?: { registered?: boolean } }).otel;
				const wasm = (window as unknown as { wasm?: { postMessage?: unknown } }).wasm;
				return Boolean(otel && wasm?.postMessage);
			};

			while (!ready() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
			if (!ready()) return false;

			(globalThis as unknown as { otel: { logLevel?: string } }).otel.logLevel = level;
			(window as unknown as { wasm: { postMessage: (m: unknown) => void } }).wasm.postMessage({
				rank,
				type: "set-otel-level",
			});

			return true;
		},
		{ level, rank: LEVEL_RANK[level], timeoutMs },
	);
};

/**
 * The newest spans as the app itself recorded them, newest first.
 *
 * For the case where a test is stuck waiting on the UI and the question is what the app is doing —
 * the aggregate reports of `endSpanCapture` answer "how long", this answers "what, and did it fail".
 */
export const recentSpans = async (
	page: Page,
	limit = 30,
): Promise<{ name: string; ms: number; error: string | null }[]> => {
	return await page.evaluate(async (limit) => {
		const otel = (
			globalThis as unknown as {
				otel?: {
					bufferedSpanProcessor?: { forceFlush?: () => Promise<void> };
					indexedDbExporter?: {
						readSessionsByScope?: (scope: string) => Promise<Map<string, unknown[]>>;
						readFromIdb?: () => Promise<unknown[]>;
					};
				};
			}
		).otel;

		if (!otel?.indexedDbExporter) return [];
		await otel.bufferedSpanProcessor?.forceFlush?.().catch(() => undefined);

		const exporter = otel.indexedDbExporter;
		const spans = (
			exporter.readSessionsByScope
				? Array.from((await exporter.readSessionsByScope("today")).values()).flat()
				: ((await exporter.readFromIdb?.()) ?? [])
		) as { name?: string; duration?: number; error?: unknown; timestamp?: number }[];

		return spans
			.slice(-limit)
			.reverse()
			.map((span) => ({
				error: span.error ? String(span.error).slice(0, 200) : null,
				ms: Math.round(span.duration ?? 0),
				name: span.name ?? "?",
			}));
	}, limit);
};

/**
 * Remembers which spans already exist, so the next capture reports only new ones.
 *
 * The set of ids lives on `window`, not in Node: keeping it in the page means `endSpanCapture` can
 * do the whole diff inside one `evaluate` and never ship a span across CDP.
 */
export const beginSpanCapture = async (page: Page): Promise<void> => {
	await page.evaluate(async () => {
		const seen = new Set<string>();
		(window as unknown as { e2eSeenSpanIds?: Set<string> }).e2eSeenSpanIds = seen;

		const exporter = (
			globalThis as unknown as {
				otel?: {
					indexedDbExporter?: {
						readSessionsByScope?: (scope: string) => Promise<Map<string, unknown[]>>;
						readFromIdb?: () => Promise<unknown[]>;
					};
				};
			}
		).otel?.indexedDbExporter;
		if (!exporter) return;

		// Every store of today, not just this session's. A successful sync reloads the page, and the
		// reload opens a *new* session store — so `readFromIdb`, which only ever reads the current one,
		// answers with everything that happened after the reload and nothing that happened during the
		// operation being measured. That is how a stash can cost 131 ms and be reported as absent.
		const spans = (
			exporter.readSessionsByScope
				? Array.from((await exporter.readSessionsByScope("today")).values()).flat()
				: ((await exporter.readFromIdb?.()) ?? [])
		) as { spanId?: string }[];

		for (const span of spans) if (span?.spanId) seen.add(span.spanId);
	});
};

/**
 * Flushes, then reports only spans that appeared since `beginSpanCapture`.
 *
 * Two things happen inside the page on purpose. The diff is by span id rather than by time, because
 * `timestamp` has second resolution — a time window would either drop or double-count whatever
 * shares the boundary second, while ids are exact. And the aggregation runs in the page because a
 * single publish at `full` level emits thousands of spans; serialising them over CDP would cost more
 * than the operation being measured, so only the compact report crosses the boundary.
 */
export const endSpanCapture = async (page: Page): Promise<SpanReport> => {
	return await page.evaluate(async () => {
		const otel = (
			globalThis as unknown as {
				otel?: {
					bufferedSpanProcessor?: { forceFlush?: () => Promise<void> };
					indexedDbExporter?: {
						readSessionsByScope?: (scope: string) => Promise<Map<string, unknown[]>>;
						readFromIdb?: () => Promise<unknown[]>;
					};
				};
			}
		).otel;

		// Type annotations are erased before Playwright serialises this function, so naming the shared
		// types here costs nothing at runtime.
		const empty: SpanReport = { byName: {}, byVariant: {}, slowest: [], total: 0 };
		if (!otel?.indexedDbExporter) return empty;

		// Spans sit in a buffer until flushed, so the tail of the measured section is missing without this.
		await otel.bufferedSpanProcessor?.forceFlush?.().catch(() => undefined);

		const seen = (window as unknown as { e2eSeenSpanIds?: Set<string> }).e2eSeenSpanIds ?? new Set<string>();

		// Read the same way `beginSpanCapture` did — across today's stores rather than the current
		// session's, so a reload in the middle of the measured operation does not hide its spans.
		const exporter = otel.indexedDbExporter;
		const spans = (
			exporter.readSessionsByScope
				? Array.from((await exporter.readSessionsByScope("today")).values()).flat()
				: ((await exporter.readFromIdb?.()) ?? [])
		) as {
			name?: string;
			spanId?: string;
			duration?: number;
			args?: unknown;
			attrs?: Record<string, unknown>;
		}[];

		const byName: Record<string, SpanStat> = {};
		const byVariant: Record<string, SpanStat> = {};
		const fresh: { name: string; ms: number }[] = [];

		// Arguments land in different places depending on which side emitted the span: the TS decorator
		// keeps them on `args`, the Rust encoder puts function fields into `attrs` (under the `args`
		// attribute key, or flattened next to the other attributes). Any of the three may hold a JSON
		// string instead of an object, so every candidate is parsed defensively — a span whose arguments
		// cannot be read simply contributes no variant.
		const readArgs = (span: {
			args?: unknown;
			attrs?: Record<string, unknown>;
		}): Record<string, unknown> | null => {
			for (const candidate of [span.args, span.attrs?.args, span.attrs]) {
				if (candidate && typeof candidate === "object") return candidate as Record<string, unknown>;
				if (typeof candidate !== "string") continue;
				try {
					const parsed = JSON.parse(candidate);
					if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
				} catch {
					// Not JSON — try the next location.
				}
			}
			return null;
		};

		for (const span of spans) {
			if (!span?.spanId || seen.has(span.spanId)) continue;

			const name = span.name ?? "<unnamed>";
			const ms = typeof span.duration === "number" ? span.duration : 0;

			const stat = byName[name] ?? { maxMs: 0, n: 0, totalMs: 0 };
			stat.n += 1;
			stat.totalMs += ms;
			stat.maxMs = Math.max(stat.maxMs, ms);
			byName[name] = stat;

			// Booleans only: a flag has two buckets and each one names a different code path, while a path,
			// oid or message would give one bucket per call and turn the breakdown into a span dump.
			const args = readArgs(span);
			if (args) {
				for (const argName of Object.keys(args)) {
					const value = args[argName];
					if (typeof value !== "boolean") continue;

					const key = `${name}#${argName}=${value}`;
					const variantStat = byVariant[key] ?? { maxMs: 0, n: 0, totalMs: 0 };
					variantStat.n += 1;
					variantStat.totalMs += ms;
					variantStat.maxMs = Math.max(variantStat.maxMs, ms);
					byVariant[key] = variantStat;
				}
			}

			fresh.push({ ms, name });
		}

		fresh.sort((a, b) => b.ms - a.ms);

		return { byName, byVariant, slowest: fresh.slice(0, 10), total: fresh.length };
	});
};
