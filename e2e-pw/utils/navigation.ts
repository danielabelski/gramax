import { expect, type Page as PlaywrightPage } from "@playwright/test";

/**
 * Navigates to `url`, retrying the navigation until the server answers.
 *
 * `navigationTimeout` is 15s on CI, which is a fine budget for a warm server and not enough for a
 * cold one: the first request a worker makes to the docportal or web server pays for the render
 * that request triggers, and a runner under load pays more. A single timed-out `page.goto` at that
 * moment reads as a broken test when the only thing that happened is that the server was still
 * waking up. Retrying the navigation waits for readiness instead of guessing at a bigger number.
 */
export async function gotoWhenReady(page: PlaywrightPage, url: string, options?: { timeout?: number }): Promise<void> {
	await expect(async () => {
		await page.goto(url, { waitUntil: "domcontentloaded" });
	}).toPass({ timeout: options?.timeout ?? 60_000 });
}
