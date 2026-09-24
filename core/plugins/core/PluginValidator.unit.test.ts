import type { PluginMetadata } from "@plugins/types";
import { pluginValidator } from "./PluginValidator";

const metadata = (gramaxSdk?: string): PluginMetadata => ({
	id: "test-plugin",
	name: "Test plugin",
	version: "9.8.7",
	entryPoint: "index.js",
	disabled: false,
	...(gramaxSdk !== undefined ? { engines: { gramaxSdk } } : {}),
});

describe("PluginValidator SDK compatibility", () => {
	test("accepts a plugin when its range includes the current prerelease SDK", () => {
		expect(pluginValidator.validateSdkCompatibility(metadata(">=0.1.0-alpha.10 <0.2.0"), "0.1.0-alpha.12")).toEqual(
			{
				compatible: true,
				sdkVersion: "0.1.0-alpha.12",
				requiredRange: ">=0.1.0-alpha.10 <0.2.0",
			},
		);
	});

	test("rejects a plugin when its range excludes the current SDK", () => {
		expect(pluginValidator.validateSdkCompatibility(metadata(">=0.2.0"), "0.1.0-alpha.12")).toEqual({
			compatible: false,
			sdkVersion: "0.1.0-alpha.12",
			requiredRange: ">=0.2.0",
			reason: "unsupported-sdk",
		});
	});

	test("rejects an invalid SDK range", () => {
		expect(pluginValidator.validateSdkCompatibility(metadata("not-semver"), "0.1.0-alpha.12")).toEqual({
			compatible: false,
			sdkVersion: "0.1.0-alpha.12",
			requiredRange: "not-semver",
			reason: "invalid-range",
		});
	});

	test("rejects an empty SDK range instead of treating it as any version", () => {
		expect(pluginValidator.validateSdkCompatibility(metadata(""), "0.1.0-alpha.12")).toMatchObject({
			compatible: false,
			requiredRange: "",
			reason: "invalid-range",
		});
	});

	test("accepts a legacy plugin at the fixed compatibility boundary", () => {
		expect(pluginValidator.validateSdkCompatibility(metadata(), "0.1.0-alpha.12")).toMatchObject({
			compatible: true,
			requiredRange: "<=0.1.0-alpha.12",
		});
	});

	test("rejects a legacy plugin after the fixed compatibility boundary", () => {
		expect(pluginValidator.validateSdkCompatibility(metadata(), "0.1.0-alpha.13")).toMatchObject({
			compatible: false,
			requiredRange: "<=0.1.0-alpha.12",
			reason: "unsupported-sdk",
		});
	});

	test("does not derive SDK compatibility from the plugin version", () => {
		expect(pluginValidator.validateSdkCompatibility(metadata("<=0.1.0-alpha.12"), "0.1.0-alpha.12")).toMatchObject({
			compatible: true,
		});
	});
});
