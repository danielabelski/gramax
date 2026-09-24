import { PlatformServiceNew } from "@core-ui/PlatformService";
import { addEvent, Level, traced } from "@ext/loggers/opentelemetry";
import type { PluginProps } from "@gramax/sdk";
import type { PlatformEnvironmentKey } from "@plugins/api/sdk/utilities";
import { GRAMAX_SDK_VERSION } from "@plugins/constants/sdkVersion";
import { PluginManager } from "@plugins/core/PluginManager";
import { pluginValidator, type SdkCompatibilityResult } from "@plugins/core/PluginValidator";
import {
	createBlobUrl,
	createPluginData,
	createPluginForManager,
	isPluginCompatibleWithPlatform,
	recreatePluginWithNewBlobUrl,
	revokeBlobUrl,
	updatePluginInList,
	withDisabledMetadata,
} from "@plugins/store/util";
import type { PluginConfig, PluginData } from "@plugins/types";
import assert from "assert";
import { create } from "zustand";

export interface PluginStoreType {
	manager: PluginManager | null;
	pluginsData: PluginData[];
	pluginsReady: boolean;
	isLoading: boolean;
	init: (pluginText: PluginConfig[], props?: PluginProps, app?: unknown) => Promise<PluginLoadResult>;
	clear: () => void;
	remove: (pluginId: string) => void;
	add: (pluginRaw: PluginConfig) => Promise<void>;
	toggle: (pluginId: string, disabled: boolean) => Promise<void>;
}

export type PluginLoadIssue = {
	pluginId: string;
	pluginName: string;
	type: "sdk-incompatible" | "validation-error";
	errors?: string[];
	sdkCompatibility?: SdkCompatibilityResult;
};

export type PluginLoadResult = { issues: PluginLoadIssue[] };

export const partitionPluginsForLoad = (
	plugins: PluginConfig[],
	currentPlatform: PlatformEnvironmentKey,
	sdkVersion: string = GRAMAX_SDK_VERSION,
): { plugins: PluginConfig[]; issues: PluginLoadIssue[] } =>
	traced("plugin-validation", { level: Level.Internal, omitResult: true }, () => {
		const loadable: PluginConfig[] = [];
		const issues: PluginLoadIssue[] = [];

		for (const plugin of plugins) {
			if (plugin.metadata.disabled) continue;
			if (!isPluginCompatibleWithPlatform(plugin.metadata, currentPlatform)) {
				addEvent("plugin-skipped-platform", Level.Full, { id: plugin.metadata.id, platform: currentPlatform });
				continue;
			}

			const validation = pluginValidator.validateFiles(plugin, sdkVersion);
			if (validation.valid) {
				loadable.push(plugin);
				continue;
			}

			const type = validation.sdkCompatibility ? "sdk-incompatible" : "validation-error";
			issues.push({
				pluginId: plugin.metadata.id,
				pluginName: plugin.metadata.name,
				type,
				errors: type === "validation-error" ? validation.errors : undefined,
				sdkCompatibility: validation.sdkCompatibility,
			});
			addEvent("plugin-validation-failed", Level.Commands, {
				id: plugin.metadata.id,
				errors: validation.errors.join(", "),
				sdkVersion: validation.sdkCompatibility?.sdkVersion,
				requiredRange: validation.sdkCompatibility?.requiredRange,
				reason: validation.sdkCompatibility?.reason,
			});
		}

		return { plugins: loadable, issues };
	});

export const initPluginsCore = async (
	pluginsRaw: PluginConfig[],
	props?: PluginProps,
	app?: unknown,
): Promise<{ pluginsData: PluginData[]; manager: PluginManager | undefined; issues: PluginLoadIssue[] }> => {
	const currentPlatform = PlatformServiceNew.getCurrentPlatform();
	const { plugins, issues } = partitionPluginsForLoad(pluginsRaw, currentPlatform);
	const pluginsData = plugins.map((p) => createPluginData(p, createBlobUrl(p.script)));
	const manager = await PluginManager.init(pluginsData.map(createPluginForManager), props, app);
	return { pluginsData, manager, issues };
};

export const PluginStore = create<PluginStoreType>((set, get) => ({
	manager: null,
	pluginsData: [],
	pluginsReady: false,
	isLoading: false,

	init: async (pluginsRaw, props, app) => {
		set({ pluginsReady: false, isLoading: true });
		const { pluginsData, manager, issues } = await initPluginsCore(pluginsRaw, props, app);
		set({ pluginsData, pluginsReady: true, manager: manager ?? null, isLoading: false });
		return { issues };
	},

	clear: () => {
		const { manager, pluginsData } = get();
		manager?.clear();
		pluginsData.forEach((plugin) => revokeBlobUrl(plugin.blobUrl));
		set({ pluginsData: [], manager: null, pluginsReady: false, isLoading: true });
	},

	remove: (pluginId: string) => {
		const { manager, pluginsData } = get();
		const pluginToRemove = pluginsData.find((p) => p.metadata.id === pluginId);
		if (pluginToRemove) revokeBlobUrl(pluginToRemove.blobUrl);
		set({ pluginsData: pluginsData.filter((p) => p.metadata.id !== pluginId) });
		manager?.remove(pluginId);
	},

	add: async (pluginRaw: PluginConfig) => {
		const { manager, pluginsData } = get();
		const currentPlatform = PlatformServiceNew.getCurrentPlatform();
		assert(
			isPluginCompatibleWithPlatform(pluginRaw.metadata, currentPlatform),
			`Plugin ${pluginRaw.metadata.id} is not compatible with platform ${currentPlatform}`,
		);
		const validation = pluginValidator.validateFiles(pluginRaw);
		assert(validation.valid, `Plugin validation failed: ${validation.errors.join(", ")}`);
		const blobUrl = createBlobUrl(pluginRaw.script);
		const newPluginData = createPluginData(pluginRaw, blobUrl);
		await manager?.add(createPluginForManager(newPluginData));
		set({ pluginsData: [...pluginsData, newPluginData] });
	},

	toggle: async (pluginId: string, disabled: boolean) => {
		const { manager, pluginsData } = get();
		if (!manager) return;
		const pluginData = pluginsData.find((p) => p.metadata.id === pluginId);
		if (!pluginData) return;

		if (disabled) {
			manager.remove(pluginId);
			set({ pluginsData: updatePluginInList(pluginsData, pluginId, (p) => withDisabledMetadata(p, true)) });
			return;
		}

		const currentPlatform = PlatformServiceNew.getCurrentPlatform();
		if (!isPluginCompatibleWithPlatform(pluginData.metadata, currentPlatform)) {
			addEvent("plugin-toggle-incompatible-platform", Level.Full, { id: pluginId, platform: currentPlatform });
			return;
		}

		const enabledPluginData = withDisabledMetadata(recreatePluginWithNewBlobUrl(pluginData), false);
		await manager.add(createPluginForManager(enabledPluginData));
		set({ pluginsData: updatePluginInList(pluginsData, pluginId, () => enabledPluginData) });
	},
}));
