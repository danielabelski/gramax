import { expect, type Page as PlaywrightPage } from "@playwright/test";

/**
 * Runs `fn` inside the page against the app, retrying while the app is still coming up.
 *
 * Anything that reaches into `window.app` races the app's own navigation: a reload or a route
 * change tears down the execution context mid-call ("Execution context was destroyed"), and for a
 * moment after it the catalog is mounted but the article is not, so the call throws or reads an
 * empty document. Both look like flake and neither is. Waiting for `window.app` and retrying the
 * whole call is the only honest way to talk to the app from a test.
 *
 * The retry replays `fn` from the start, so `fn` has to be safe to run twice — writing a file tree,
 * setting markdown or reading state all are. Anything that appends rather than overwrites is not,
 * and belongs in a plain `page.evaluate`.
 */
export async function evaluateOnApp<Arg, R>(
	page: PlaywrightPage,
	fn: (arg: Arg) => R | Promise<R>,
	arg: Arg,
	options?: { timeout?: number },
): Promise<R> {
	let result: R;

	await expect(async () => {
		await page.waitForFunction(() => Boolean(window.app), null, {
			timeout: 5000,
		});
		result = await page.evaluate(fn, arg);
	}).toPass({ timeout: options?.timeout ?? 20_000 });

	return result!;
}
