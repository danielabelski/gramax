import type { PluginConfig } from "@plugins/types";
import { partitionPluginsForLoad } from "./PluginStore";

const plugin = (id: string, range: string): PluginConfig => ({
	metadata: {
		id,
		name: id === "compatible" ? "Compatible module" : "Outdated module",
		version: "1.0.0",
		entryPoint: "index.js",
		disabled: false,
		platform: [],
		engines: { gramaxSdk: range },
	},
	script: `export default class ${id} {}`,
});

describe("partitionPluginsForLoad", () => {
	test("keeps compatible modules loadable and reports an incompatible module", () => {
		const result = partitionPluginsForLoad(
			[plugin("compatible", ">=0.1.0-alpha.12 <0.2.0"), plugin("outdated", "<0.1.0-alpha.12")],
			"Web",
			"0.1.0-alpha.12",
		);

		expect(result.plugins.map((item) => item.metadata.id)).toEqual(["compatible"]);
		expect(result.issues).toEqual([
			{
				pluginId: "outdated",
				pluginName: "Outdated module",
				type: "sdk-incompatible",
				sdkCompatibility: {
					compatible: false,
					sdkVersion: "0.1.0-alpha.12",
					requiredRange: "<0.1.0-alpha.12",
					reason: "unsupported-sdk",
				},
			},
		]);
	});

	test("does not let an invalid module prevent another module from loading", () => {
		const invalid = plugin("invalid", ">=0.1.0-alpha.12");
		invalid.metadata.version = "invalid";

		const result = partitionPluginsForLoad(
			[invalid, plugin("compatible", ">=0.1.0-alpha.12")],
			"Web",
			"0.1.0-alpha.12",
		);

		expect(result.plugins.map((item) => item.metadata.id)).toEqual(["compatible"]);
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]).toMatchObject({ pluginId: "invalid", type: "validation-error" });
	});
});
