import type GitSourceData from "@gramax/core/extensions/git/core/model/GitSourceData.schema";
import { expect, type Page, test, type WebContext } from "@playwright/test";
import BaseSharedPage from "@shared-pom/page";
import "@utils/async";
import { gotoWhenReady } from "@utils/navigation";
import { getSourceDataFromEnv } from "@utils/source";
import { type FileTree, readDirToFileTree, type SourceData, setStorage, uploadAndExtractZip } from "@web/utils";

export interface WorkerBaseFixture {
	zip: string | undefined;
	experimentalFeatures: string[] | undefined;
	verboseLogging: boolean | undefined;
	dir: string | URL | undefined;
	source: "env" | GitSourceData | SourceData | undefined;
	isolated: boolean;
	/**
	 * Wipe the workspace before each test instead of seeding on top of what the last one left.
	 *
	 * Defaults to on for a test that brings its own tree (`files` / `dir` / `zip`) — it owns what is
	 * in there. Turn it off for a serial block that builds state across its tests: a fragment created
	 * in one and used in the next, a catalog cloned once and driven by the rest.
	 */
	resetWorkspace: boolean | undefined;
	isReadOnly: boolean;
	/** Touch emulation for the shared context; `hasTouch` itself is a built-in test-scoped fixture. */
	sharedContextHasTouch: boolean;
	startUrl: string;
	sharedContext: WebContext;
	sharedPage: Page;
	basePage: BaseSharedPage;
	files: FileTree | undefined;
}

export interface TestBaseFixture {
	reset: null;
}

export const baseTest = test.extend<TestBaseFixture, WorkerBaseFixture>({
	zip: [undefined, { option: true, scope: "worker" }],
	files: [undefined, { option: true, scope: "worker" }],
	dir: [undefined, { option: true, scope: "worker" }],
	source: [undefined, { option: true, scope: "worker" }],
	experimentalFeatures: [undefined, { option: true, scope: "worker" }],
	verboseLogging: [undefined, { option: true, scope: "worker" }],
	startUrl: ["/", { option: true, scope: "worker" }],
	isolated: [true, { option: true, scope: "worker" }],
	resetWorkspace: [undefined, { option: true, scope: "worker" }],
	isReadOnly: [false, { option: true, scope: "worker" }],
	sharedContextHasTouch: [false, { option: true, scope: "worker" }],

	sharedContext: [
		async ({ browser, sharedContextHasTouch }, use) => {
			const context = await browser.newContext({
				hasTouch: sharedContextHasTouch,
				locale: "en-US",
				acceptDownloads: true,
				permissions: ["clipboard-read", "clipboard-write"],
			});
			await use(context);
			await context.close();
		},
		{ scope: "worker" },
	],

	sharedPage: [
		async (
			{
				sharedContext,
				isolated,
				zip,
				files,
				dir,
				source,
				experimentalFeatures,
				verboseLogging,
				isReadOnly,
				startUrl,
			},
			use,
		) => {
			const page = await sharedContext.newPage();
			await gotoWhenReady(page, "/");

			if (!isolated) {
				await preparePage({
					sharedPage: page,
					zip,
					files,
					dir,
					source,
					experimentalFeatures,
					verboseLogging,
					isReadOnly,
					startUrl,
					basePage: new BaseSharedPage(page, startUrl),
				});
				await gotoWhenReady(page, startUrl!);
			}

			await use(page);

			await page.close();
		},
		{ scope: "worker" },
	],

	basePage: [
		async ({ sharedPage, startUrl }, use) => {
			await use(new BaseSharedPage(sharedPage, startUrl));
		},
		{ scope: "worker" },
	],

	reset: [
		async (
			{
				sharedPage,
				isolated,
				zip,
				files,
				dir,
				source,
				experimentalFeatures,
				verboseLogging,
				isReadOnly,
				startUrl,
				resetWorkspace,
			},
			use,
		) => {
			if (!isolated) {
				await gotoWhenReady(sharedPage, startUrl!);
				await use(null);
				return;
			}
			await preparePage({
				sharedPage,
				zip,
				files,
				dir,
				source,
				experimentalFeatures,
				verboseLogging,
				isReadOnly,
				startUrl,
				basePage: new BaseSharedPage(sharedPage, startUrl),
				wipe: resetWorkspace ?? Boolean(files || dir || zip),
			});
			await gotoWhenReady(sharedPage, startUrl!);
			await use(null);
		},
		{ auto: true },
	],
});

const preparePage = async ({
	sharedPage: page,
	zip,
	files,
	dir,
	source,
	experimentalFeatures,
	verboseLogging,
	isReadOnly,
	basePage,
	wipe,
}: Partial<WorkerBaseFixture> & { wipe?: boolean }) => {
	// Seeding writes files, it never removes them, and the browser context is worker-scoped, so an
	// article one test creates outlives it and turns up in the next one — a duplicate row in the
	// tree, a stale catalog, a title that suddenly matches two things.
	//
	// Only a test that brings its own tree gets the workspace wiped: it owns what is in there. A
	// test that clones instead is the opposite case — its catalog is set up once and the rest of the
	// serial block works on it, so wiping between tests would delete the thing under test.
	if (wipe) {
		// The wipe pulls the workspace directory out from under a file provider that may still be
		// reading it, and the wasm filesystem reports that as `IO (remove_dir)`. Nothing about the
		// failure is final — the goal is an empty workspace — so ask again until it is empty.
		await expect(async () => {
			await page!.evaluate(async () => await window.debug.clear());
		}).toPass({ timeout: 30_000 });
	}

	if (zip) {
		await uploadAndExtractZip(page!, zip);
	}

	if (dir) {
		const tree = await readDirToFileTree(dir);
		await basePage?.createFileTree(page!, tree);
	}

	if (files) {
		await basePage?.createFileTree(page!, files);
	}

	if (source) {
		await setStorage(page!, source === "env" ? getSourceDataFromEnv() : source);
	}

	await page!.evaluate(
		({ experimentalFeatures, verboseLogging, isReadOnly }) => {
			window.localStorage.setItem("NO_DESKTOP", "1");
			// The browser's print dialog is modal and would hang a run; with this the PDF export stops right
			// before opening it and leaves the paginated pages in the document, which is what a test can read.
			window.localStorage.setItem("NO_PRINT", "1");

			// Tooltips open after a human-facing hover delay; e2e asserts the rendered tooltip,
			// not the wait, so open them instantly (read by core/ui-logic/timings.ts on load).
			window.localStorage.setItem("gx-timing-tooltipDelayMs", "0");
			window.localStorage.setItem("gx-timing-tooltipLongDelayMs", "0");

			if (experimentalFeatures) window.localStorage.setItem("enabled-features", experimentalFeatures.join(","));
			if (verboseLogging) {
				// Seed the app-settings cache (zustand persist blob) so logging is on at boot (`logging.level` !== "off").
				const key = "app-settings-cache";
				const cache = JSON.parse(window.localStorage.getItem(key) ?? '{"state":{"values":{}},"version":1}');
				cache.state = cache.state ?? {};
				cache.state.values = cache.state.values ?? {};
				cache.state.values.logging = { ...cache.state.values.logging, level: "important" };
				window.localStorage.setItem(key, JSON.stringify(cache));
			}
			if (isReadOnly) window.localStorage.setItem("READ_ONLY", "1");
		},
		{ experimentalFeatures, verboseLogging, isReadOnly },
	);
};
