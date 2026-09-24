import type { WorkspaceConfig } from "@ext/workspace/WorkspaceConfig";
import { expect, type Locator, type Page } from "@playwright/test";
import { evaluateOnApp } from "@utils/app";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { homeTest as test } from "@web/fixtures/home.fixture";
import { ClonePom } from "@web/pom/clone.pom";
import { GitPom } from "@web/pom/git.pom";

test.use({});

const source = getSourceDataFromEnv();
const repo = getTestRepoInfoFromEnv();

const CATALOG_BUTTON = "No Index";
const LFS_TEST_PATTERN = "*.e2e-lfs-test";

const setWorkspaceLfsPatterns = async (page: Page, patterns: string[] | null) => {
	await evaluateOnApp(
		page,
		async (patterns) => {
			const app = await window.app!;
			const workspace = app.wm.current();
			const workspaceConfig = app.wm.getWorkspaceConfig(workspace.path())?.config;
			if (!workspaceConfig) throw new Error("Workspace config is not available");
			const currentConfig = workspaceConfig.inner();

			const git = patterns ? { ...(currentConfig.git ?? {}), lfs: { patterns } } : undefined;
			workspaceConfig.update({
				...currentConfig,
				git,
			} satisfies WorkspaceConfig);
			await workspaceConfig.save();
		},
		patterns,
	);
};

declare global {
	interface Window {
		collapseFrames: { heights: number[]; done: boolean };
	}
}

type TextStyle = { color: string; fontSize: string };

const textStyleOf = (locator: Locator): Promise<TextStyle> =>
	locator.evaluate((el) => {
		const style = getComputedStyle(el);
		return { color: style.color, fontSize: style.fontSize };
	});

/**
 * Waits out the panel's own open/close animation. Only its own — the dialog subtree also carries the
 * skeletons' endless pulse, and waiting on that never returns.
 */
const settle = (panel: Locator): Promise<unknown> =>
	panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

/**
 * Distance from the bottom of the disclosure trigger to the first row inside its panel. The panel
 * box itself opens flush against the trigger: the spacing sits on the wrapper within it, so that it
 * grows and shrinks with the panel instead of snapping once the panel is hidden.
 */
const triggerToDetailsGap = async (page: Page, trigger: Locator): Promise<number> => {
	const panelId = await trigger.getAttribute("aria-controls");
	expect(panelId, "the disclosure trigger has to name its panel").toBeTruthy();
	// Radix ids carry colons, which a `#id` selector cannot hold.
	await settle(page.locator(`[id="${panelId}"]`));

	// Both rects in one frame: an opening panel keeps moving the vertically centred dialog under them.
	return trigger.evaluate((el, id) => {
		const row = document.getElementById(id)?.firstElementChild?.firstElementChild;
		if (!row) throw new Error("the disclosure panel has no row to measure against");
		return row.getBoundingClientRect().top - el.getBoundingClientRect().bottom;
	}, panelId);
};

/**
 * Heights of the disclosure panel, one per frame, from just before `collapse()` until two seconds
 * after it — long enough to cover the closing animation and whatever follows it.
 */
const collapseFrames = async (page: Page, panelId: string, collapse: () => Promise<void>): Promise<number[]> => {
	await page.evaluate((id) => {
		window.collapseFrames = { heights: [], done: false };
		const until = performance.now() + 2000;
		const tick = () => {
			window.collapseFrames.heights.push(document.getElementById(id)?.getBoundingClientRect().height ?? 0);
			if (performance.now() < until) requestAnimationFrame(tick);
			else window.collapseFrames.done = true;
		};
		requestAnimationFrame(tick);
	}, panelId);

	await collapse();
	await page.waitForFunction(() => window.collapseFrames.done, undefined, { timeout: 15_000 });

	return page.evaluate(() => window.collapseFrames.heights);
};

test.describe
	.serial("lfs migration", () => {
		test("clone", async ({ homePage }) => {
			test.slow();

			const clone = new ClonePom(homePage);
			await clone.cloneWithNewStorage(source, { group: repo.group, repo: repo.testRepoNoIndex });
			await clone.openCatalog(CATALOG_BUTTON);
		});

		test("sync without divergence shows no modal", async ({ basePage }) => {
			const page = basePage.raw;

			await page.getByRole("button", { name: CATALOG_BUTTON }).click();
			await basePage.waitForLoad();

			await new GitPom(page).clickSync();
			await basePage.waitForLoad();

			await basePage.assertNoModal();
			await expect(page.getByRole("alertdialog")).toBeHidden();
		});

		test("diverged patterns show modal with details, cancel applies nothing", async ({ basePage }) => {
			const page = basePage.raw;

			await page.getByRole("button", { name: CATALOG_BUTTON }).click();
			await basePage.waitForLoad();

			await setWorkspaceLfsPatterns(page, [LFS_TEST_PATTERN]);

			await new GitPom(page).clickSync();

			const dialog = page.getByRole("alertdialog");
			await expect(dialog).toBeVisible({ timeout: 30_000 });
			await expect(dialog.getByText("Files need to be moved to new storage")).toBeVisible();

			const title = await textStyleOf(dialog.getByRole("heading"));
			const body = await textStyleOf(dialog.locator("p").first());
			expect(body.color, "the body reads as dark as the dialog's own title").toBe(title.color);

			const details = dialog.getByRole("button", { name: "Technical details" });
			expect((await textStyleOf(details)).fontSize, "the trigger reads at the body's size").toBe(body.fontSize);

			await details.click();
			await expect(dialog.getByText(LFS_TEST_PATTERN, { exact: true })).toBeVisible();

			expect(await triggerToDetailsGap(page, details), "the panel is spaced off its trigger").toBeGreaterThan(0);

			await dialog.getByRole("button", { name: "Remind me later" }).click();
			await expect(dialog).toBeHidden();
		});

		test("the details panel collapses once, without replaying its closing animation", async ({ basePage }) => {
			const page = basePage.raw;

			await page.getByRole("button", { name: CATALOG_BUTTON }).click();
			await basePage.waitForLoad();

			await new GitPom(page).clickSync();

			const dialog = page.getByRole("alertdialog");
			await expect(dialog).toBeVisible({ timeout: 30_000 });

			const details = dialog.getByRole("button", { name: "Technical details" });
			const panelId = await details.getAttribute("aria-controls");
			if (!panelId) throw new Error("the disclosure trigger has to name its panel");
			// Radix ids carry colons, which a `#id` selector cannot hold.
			const panel = page.locator(`[id="${panelId}"]`);

			await details.click();
			await expect(dialog.getByText(LFS_TEST_PATTERN, { exact: true })).toBeVisible();
			await settle(panel);

			const frames = await collapseFrames(page, panelId, () => details.click());
			const trace = frames.map((height) => Math.round(height)).join(" ");

			expect(Math.max(...frames), "the panel has to be tall enough for a replay to show").toBeGreaterThan(20);

			const closed = frames.findIndex((height) => height < 0.5);
			expect(
				closed,
				`the details panel has to collapse to nothing; heights were ${trace}`,
			).toBeGreaterThanOrEqual(0);
			expect(
				Math.max(...frames.slice(closed)),
				`a collapsed panel may not come back; heights were ${trace}`,
			).toBeLessThan(0.5);

			await dialog.getByRole("button", { name: "Remind me later" }).click();
			await expect(dialog).toBeHidden();
		});

		test("divergence is re-detected on next sync after cancel", async ({ basePage }) => {
			const page = basePage.raw;

			await page.getByRole("button", { name: CATALOG_BUTTON }).click();
			await basePage.waitForLoad();

			await new GitPom(page).clickSync();

			const dialog = page.getByRole("alertdialog");
			await expect(dialog).toBeVisible({ timeout: 30_000 });
			await expect(dialog.getByText("Files need to be moved to new storage")).toBeVisible();

			await dialog.getByRole("button", { name: "Remind me later" }).click();
			await expect(dialog).toBeHidden();

			await setWorkspaceLfsPatterns(page, null);
		});
	});
