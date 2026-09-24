import { PluginFileParser } from "./PluginFileParser";

describe("PluginFileParser plugin manifest paths", () => {
	test("uses manifest.json for new plugin storage", () => {
		expect(PluginFileParser.getPluginFilePaths("example").metadata).toBe("manifest.json");
	});

	test("prefers manifest.json and falls back to _metadata.json", () => {
		expect(PluginFileParser.getMetadataFileName(new Set(["manifest.json", "_metadata.json"]))).toBe(
			"manifest.json",
		);
		expect(PluginFileParser.getMetadataFileName(new Set(["_metadata.json"]))).toBe("_metadata.json");
		expect(PluginFileParser.getMetadataFileName(new Set(["locale.json"]))).toBeUndefined();
	});
});
