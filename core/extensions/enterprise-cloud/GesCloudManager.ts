import type { EnterpriseCloudConfig } from "@app/config/AppConfig";
import type YamlFileConfig from "@core/utils/YamlFileConfig";
import type { AppConfigWithGesCloud } from "@ext/enterprise-cloud/config/AppConfigWithGesCloud";
import { Level, trace } from "@ext/loggers/opentelemetry";
import { getExecutingEnvironment } from "../../../app/resolveModule/env";
import { GesCloudApi } from "./GesCloudApi";
import { updateGesCloudUrl } from "./logic/GesCloudUrl/GesCloudUrlUtils";

export class GesCloudManager {
	private _actualUrlForDesktop: string | undefined;

	constructor(
		private readonly _defaultConfig: EnterpriseCloudConfig,
		private readonly _config?: YamlFileConfig<AppConfigWithGesCloud>,
	) {}

	async getConfig(): Promise<EnterpriseCloudConfig> {
		if (getExecutingEnvironment() === "tauri") return this._getActualConfigForDesktop();
		return this._getConfig();
	}

	isEnabled(): boolean {
		return this._getConfig().url && this._getConfig().enabled;
	}

	@trace({ level: Level.Important })
	disable() {
		return this._updateConfig({ enabled: false });
	}

	@trace({ level: Level.Important })
	enable() {
		return this._updateConfig({ enabled: true });
	}

	@trace({ level: Level.Important })
	setGesCloudUrl(gesCloudUrl: string) {
		return this._updateConfig({ url: gesCloudUrl });
	}

	private _getConfig(): EnterpriseCloudConfig {
		return {
			...this._defaultConfig,
			...(this._config?.inner?.()?.cloud ?? {}),
		};
	}

	private async _getActualConfigForDesktop(): Promise<EnterpriseCloudConfig> {
		const actualUrl = this._actualUrlForDesktop ?? (await GesCloudApi.getCloudInstanceUrl());
		if (!this._actualUrlForDesktop) this._actualUrlForDesktop = actualUrl;

		const config = this._getConfig();
		const updateResult = updateGesCloudUrl(actualUrl, config.url);
		if (updateResult.updated) {
			config.url = updateResult.newGesCloudUrl;
			await this._updateConfig({ url: updateResult.newGesCloudUrl });
		}
		return config;
	}

	private _updateConfig(config: EnterpriseCloudConfig) {
		const currentConfig = this._config?.inner?.() ?? ({} as AppConfigWithGesCloud);
		this._config?.set("cloud", { ...currentConfig.cloud, ...config });
		return this._config?.save();
	}
}
