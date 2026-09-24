import type { PlatformEnvironmentKey } from "@plugins/api/sdk/utilities";
import { GRAMAX_SDK_VERSION, LEGACY_PLUGIN_MAX_SDK_VERSION } from "@plugins/constants/sdkVersion";
import { PluginFileParser } from "@plugins/core/PluginFileParser";
import type { PluginConfig, PluginMetadata } from "@plugins/types";
import semver from "semver";

export type SdkCompatibilityIssueReason = "invalid-range" | "unsupported-sdk";

export interface SdkCompatibilityResult {
	compatible: boolean;
	sdkVersion: string;
	requiredRange: string;
	reason?: SdkCompatibilityIssueReason;
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	metadata?: PluginMetadata;
	sdkCompatibility?: SdkCompatibilityResult;
}

export class PluginValidator {
	validateFiles(
		pluginConfig: PluginConfig | PluginMetadata,
		sdkVersion: string = GRAMAX_SDK_VERSION,
	): ValidationResult {
		const errors: string[] = [];
		const metadata = "metadata" in pluginConfig ? pluginConfig.metadata : pluginConfig;

		this._validateMetadataFields(metadata, errors);
		this._validateStyleMetadata(metadata, errors);
		if ("metadata" in pluginConfig) this._validateDeclaredStyleAssets(pluginConfig, errors);

		this._validatePluginVersion(metadata, errors);
		const sdkCompatibility = this.validateSdkCompatibility(metadata, sdkVersion);
		if (!sdkCompatibility.compatible) {
			errors.push(
				sdkCompatibility.reason === "invalid-range"
					? `Plugin SDK range '${sdkCompatibility.requiredRange}' is not a valid semantic version range`
					: `Plugin requires Gramax SDK '${sdkCompatibility.requiredRange}', but the application provides '${sdkCompatibility.sdkVersion}'`,
			);
		}

		return {
			valid: errors.length === 0,
			errors,
			metadata: errors.length === 0 ? metadata : undefined,
			sdkCompatibility: sdkCompatibility.compatible ? undefined : sdkCompatibility,
		};
	}

	private _validateMetadataFields(metadata: PluginMetadata, errors: string[]): void {
		if (!metadata.id || typeof metadata.id !== "string") {
			errors.push("Metadata must have a valid 'id' field");
		}

		if (!metadata.name || typeof metadata.name !== "string") {
			errors.push("Metadata must have a valid 'name' field");
		}

		if (!metadata.version || typeof metadata.version !== "string") {
			errors.push("Metadata must have a valid 'version' field");
		}
	}

	private _validateStyleMetadata(metadata: PluginMetadata, errors: string[]): void {
		if (!metadata.styles) return;
		try {
			PluginFileParser.getStylePaths(metadata);
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}

	private _validateDeclaredStyleAssets(pluginConfig: PluginConfig, errors: string[]): void {
		let stylePaths: string[];
		try {
			stylePaths = PluginFileParser.getStylePaths(pluginConfig.metadata);
		} catch {
			return;
		}
		if (!stylePaths.length) return;

		const styleAssets = new Set(
			(pluginConfig.assets ?? [])
				.filter((asset) => asset.kind === "style")
				.map((asset) => asset.path.replace(/\\/g, "/").replace(/^\.\/+/, "")),
		);

		for (const stylePath of stylePaths) {
			if (!styleAssets.has(stylePath)) {
				errors.push(`Plugin style file is declared but missing from plugin assets: ${stylePath}`);
			}
		}
	}

	private _validatePluginVersion(metadata: PluginMetadata, errors: string[]): void {
		const pluginVersion = metadata.version;

		// Skip compatibility check if version field is already invalid
		if (!pluginVersion) {
			return;
		}

		// 1. Check if plugin version is valid semver format
		if (!semver.valid(pluginVersion)) {
			errors.push(`Plugin version '${pluginVersion}' is not a valid semantic version`);
			return;
		}
	}

	validateSdkCompatibility(
		metadata: PluginMetadata,
		sdkVersion: string = GRAMAX_SDK_VERSION,
	): SdkCompatibilityResult {
		const requiredRange = metadata.engines?.gramaxSdk ?? `<=${LEGACY_PLUGIN_MAX_SDK_VERSION}`;

		if (typeof requiredRange !== "string" || !requiredRange.trim() || !semver.validRange(requiredRange)) {
			return { compatible: false, sdkVersion, requiredRange, reason: "invalid-range" };
		}

		if (!semver.satisfies(sdkVersion, requiredRange, { includePrerelease: true })) {
			return { compatible: false, sdkVersion, requiredRange, reason: "unsupported-sdk" };
		}

		return { compatible: true, sdkVersion, requiredRange };
	}

	validatePlatform(metadata: PluginMetadata, currentPlatform: PlatformEnvironmentKey): boolean {
		if (!metadata.platform || !Array.isArray(metadata.platform) || metadata.platform.length === 0) {
			return true;
		}
		return metadata.platform.includes(currentPlatform);
	}
}

export const pluginValidator = new PluginValidator();
