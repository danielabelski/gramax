#!/usr/bin/env bun
/**
 * Aggregates the NDJSON written by `utils/timings.ts` into one table.
 *
 * The `list` reporter prints nothing about timings, and it is the reporter every suite here uses, so
 * the numbers have to be read out of the artifact afterwards rather than off the run.
 *
 * Usage:
 *   bun run timings              # table, grouped by section
 *   bun run timings --json       # same data, machine-readable, for comparing two runs
 *   bun run timings --dir <path> # read somewhere other than report/timings
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { TimingRecord } from "../utils/timings";
import { TIMINGS_DIR } from "../utils/timings";

type Summary = {
	section: string;
	runs: number;
	n: number;
	min: number;
	p50: number;
	p95: number;
	max: number;
	fails: number;
};

const percentile = (sorted: number[], p: number): number => {
	if (!sorted.length) return 0;
	// Nearest-rank: with the handful of samples a run produces, interpolating invents precision.
	const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
	return sorted[rank - 1]!;
};

/** Walks `timings/<runId>/w<n>.ndjson`, so several runs aggregate together. */
const readRecords = (dir: string): TimingRecord[] => {
	let entries: string[];
	try {
		entries = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((name) => name.endsWith(".ndjson"));
	} catch {
		console.warn(`no timings at ${dir} — run a suite that calls \`measure\` first`);
		return [];
	}

	return entries.flatMap((name) =>
		readFileSync(join(dir, name), "utf8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as TimingRecord),
	);
};

const summarize = (records: TimingRecord[]): Summary[] => {
	const bySection = new Map<string, TimingRecord[]>();
	for (const r of records) bySection.set(r.section, [...(bySection.get(r.section) ?? []), r]);

	return [...bySection.entries()]
		.map(([section, rs]) => {
			// Only successful runs shape the distribution; a section that threw after 200ms would
			// otherwise pass for the fastest one there is.
			const durations = rs
				.filter((r) => r.ok)
				.map((r) => r.ms)
				.sort((a, b) => a - b);

			return {
				fails: rs.filter((r) => !r.ok).length,
				runs: new Set(rs.map((r) => r.runId)).size,
				max: durations.at(-1) ?? 0,
				min: durations[0] ?? 0,
				n: rs.length,
				p50: percentile(durations, 50),
				p95: percentile(durations, 95),
				section,
			};
		})
		.sort((a, b) => b.p50 - a.p50);
};

const table = (rows: Summary[]): string => {
	const header = ["section", "runs", "n", "min", "p50", "p95", "max", "fails"];
	const body = rows.map((r) => [
		r.section,
		String(r.runs),
		String(r.n),
		r.min.toFixed(0),
		r.p50.toFixed(0),
		r.p95.toFixed(0),
		r.max.toFixed(0),
		String(r.fails),
	]);

	const widths = header.map((h, i) => Math.max(h.length, ...body.map((row) => row[i]!.length)));
	const line = (cells: string[]) =>
		cells.map((c, i) => (i ? c.padStart(widths[i]!) : c.padEnd(widths[0]!))).join("  ");

	return [line(header), widths.map((w) => "-".repeat(w)).join("  "), ...body.map(line)].join("\n");
};

const dirArg = process.argv.indexOf("--dir");
const dir = dirArg === -1 ? TIMINGS_DIR : process.argv[dirArg + 1]!;

const records = readRecords(dir);
const summary = summarize(records);

if (process.argv.includes("--json")) {
	process.stdout.write(`${JSON.stringify({ records: records.length, summary }, null, 2)}\n`);
} else {
	process.stdout.write(`${records.length} timing records from ${dir}\n\n${table(summary)}\n`);
}
