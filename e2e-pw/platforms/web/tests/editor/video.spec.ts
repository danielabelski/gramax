import { expect } from "@playwright/test";
import { editorTest } from "@web/fixtures/editor.fixture";

const VIDEO_URL = "https://www.youtube.com/watch?v=F4ryW8YBZco";
const EMBED_URL = "https://www.youtube.com/embed/F4ryW8YBZco";

editorTest.describe("YouTube video", () => {
	editorTest("pasted link loads the YouTube player without an error", async ({ editor, catalogPage }) => {
		const page = catalogPage.raw;

		// The CI runner cannot reach youtube.com: the embed request hangs without a response
		const probe = await page.context().newPage();
		const isYoutubeReachable = await probe
			.goto(EMBED_URL, { waitUntil: "commit", timeout: 15_000 })
			.then((response) => !!response?.ok())
			.catch(() => false);
		await probe.close();
		editorTest.skip(!isYoutubeReachable, "youtube.com is unreachable from this runner");

		await editor.pasteText(VIDEO_URL);
		await editor.assertMarkdownContains(`path="${VIDEO_URL}"`);

		const iframe = page.locator(`iframe[src="${EMBED_URL}"]`);
		await expect(iframe).toBeVisible({ timeout: 20_000 });

		const player = page.frameLocator(`iframe[src="${EMBED_URL}"]`).locator(".html5-video-player");
		await expect(player).toBeVisible({ timeout: 30_000 });
		await expect(player.locator(".ytp-error")).toHaveCount(0);

		// YouTube shows error 153 as soon as the player loads; pressing play from a CI address hits its bot check
		await expect(player).toHaveClass(/unstarted-mode/);
		await expect(player.locator(".ytp-error")).toHaveCount(0);
	});

	editorTest("player gets its full size while still loading", async ({ editor, catalogPage }) => {
		const page = catalogPage.raw;
		await page.route(`${EMBED_URL}*`, () => {});

		await editor.pasteText(VIDEO_URL);

		const iframe = page.locator(`iframe[src="${EMBED_URL}"]`);
		await expect(iframe).toBeAttached({ timeout: 20_000 });
		await expect(page.locator('[data-type="video"] .skeleton')).toBeAttached();

		const box = await iframe.boundingBox();
		expect(box?.width).toBeGreaterThan(300);
		expect(box?.height).toBeGreaterThan(150);
	});
});
