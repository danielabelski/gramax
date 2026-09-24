import type { PluginConfig } from "@plugins/types";
import { filterOutBuiltInPlugins } from "./filterOutBuiltInPlugins";

const plugin = (id: string, isBuiltIn = false): PluginConfig =>
	({
		metadata: { id, isBuiltIn },
		script: "",
	}) as PluginConfig;

describe("filterOutBuiltInPlugins", () => {
	test("excludes built-in modules from persisted plugins", () => {
		expect(filterOutBuiltInPlugins([plugin("styleGuide", true), plugin("custom"), plugin("quiz", true)])).toEqual([
			plugin("custom"),
		]);
	});
});
