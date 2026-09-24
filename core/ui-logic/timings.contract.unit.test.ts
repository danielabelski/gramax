import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

// The hover delay is one product-wide decision, taken in timings.ts and applied by the tooltip
// provider. Types already block the two supported ways to override it (`delayDuration` is not in
// our Tooltip props, and both take a named tier instead of a number), so this test guards what types cannot
// see: a spread, an `as any`, a component that talks to the library directly.
const ROOTS = ["core", "apps"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".next", "target", "report"]);

const OFFENDERS = [
	{ what: "delayDuration с числом", re: /delayDuration=\{\s*\d/ },
	{ what: "tooltipDelay с числом", re: /tooltipDelay=\{\s*\d/ },
	{ what: "пара задержек Tippy числами", re: /delay=\{\s*\[\s*\d/ },
];

const sourceFiles = (dir: string, acc: string[] = []): string[] => {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry)) continue;
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) sourceFiles(path, acc);
		else if (/\.tsx?$/.test(path)) acc.push(path);
	}
	return acc;
};

describe("tooltip delays stay in timings.ts", () => {
	const repoRoot = join(__dirname, "..", "..");

	it("no component sets its own hover delay", () => {
		const found: string[] = [];

		for (const root of ROOTS) {
			for (const file of sourceFiles(join(repoRoot, root))) {
				const source = readFileSync(file, "utf8");
				for (const { what, re } of OFFENDERS) {
					if (re.test(source)) found.push(`${relative(repoRoot, file)}: ${what}`);
				}
			}
		}

		expect(found).toEqual([]);
	});
});
