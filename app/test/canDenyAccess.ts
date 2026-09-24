import { chmodSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Whether mode bits mean anything for this process. They don't for root, which reads a `0o000`
 * directory happily — and root is exactly what the `tests` job gets, since the playwright image
 * in `.ci/images/playwright.dockerfile` declares no `USER`.
 *
 * Probed once at module load so callers can pick `test` or `test.skip`: a permission test that
 * silently `return`s under root reports as passed, and a suite that reports green while
 * exercising nothing is worse than no suite at all. Skipped shows up in the junit report.
 */
const probe = (): boolean => {
	const dir = mkdtempSync(join(tmpdir(), "gx-deny-probe-"));
	try {
		chmodSync(dir, 0o000);
		readdirSync(dir);
		return false;
	} catch {
		return true;
	} finally {
		chmodSync(dir, 0o755);
		rmSync(dir, { recursive: true, force: true });
	}
};

export const canDenyAccess = probe();

/** `test`, or `test.skip` where the process can read anything regardless of mode bits. */
export const testUnlessRoot = canDenyAccess ? test : test.skip;
