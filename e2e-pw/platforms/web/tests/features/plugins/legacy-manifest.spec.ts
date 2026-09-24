import { expect } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";
import { CATALOG, pluginDir, type TestWindow, TRACKER_PLUGIN_JS, workspacePlugins } from "./helpers";

const { "manifest.json": metadata, ...pluginFiles } = pluginDir("tracker-plugin", TRACKER_PLUGIN_JS);

catalogTest.use({
	startUrl: "/test-catalog",
	files: {
		...CATALOG,
		...workspacePlugins({
			"tracker-plugin": {
				...pluginFiles,
				"_metadata.json": metadata,
			},
		}),
	},
});

catalogTest.describe("Legacy plugin manifest", () => {
	catalogTest("loads a plugin stored with _metadata.json", async ({ catalogPage }) => {
		await expect
			.poll(() => catalogPage.raw.evaluate(() => (window as TestWindow).__trackerPlugin?.loaded), {
				timeout: 10_000,
			})
			.toBe(true);
	});
});
