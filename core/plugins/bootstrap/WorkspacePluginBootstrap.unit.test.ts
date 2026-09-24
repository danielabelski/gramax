import type { PluginLoadIssue } from "@plugins/store/PluginStore";
import { ensureWorkspacePluginsLoaded, resetWorkspacePluginBootstrap } from "./WorkspacePluginBootstrap";

describe("ensureWorkspacePluginsLoaded compatibility issues", () => {
	afterEach(() => resetWorkspacePluginBootstrap());

	test("reports each SDK-incompatible module returned by the loader", async () => {
		const issue: PluginLoadIssue = {
			pluginId: "outdated",
			pluginName: "Outdated module",
			type: "sdk-incompatible",
			sdkCompatibility: {
				compatible: false,
				sdkVersion: "0.1.0-alpha.12",
				requiredRange: "<0.1.0-alpha.12",
				reason: "unsupported-sdk",
			},
		};
		const received: PluginLoadIssue[] = [];

		await ensureWorkspacePluginsLoaded({
			workspacePath: "workspace" as never,
			force: true,
			getPlugins: async () => ({ plugins: [], errors: [] }),
			clearAllPlugins: () => undefined,
			loadPlugins: async () => ({ issues: [issue] }),
			makePluginReady: () => undefined,
			getPluginIsReady: () => false,
			onPluginCompatibilityIssue: (value) => received.push(value),
		});

		expect(received).toEqual([issue]);
	});
});
