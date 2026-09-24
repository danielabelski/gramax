import type { PluginConfig } from "@plugins/types";

export const filterOutBuiltInPlugins = (plugins: PluginConfig[]): PluginConfig[] =>
	plugins.filter((plugin) => !plugin.metadata.isBuiltIn);
