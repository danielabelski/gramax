import type FileProvider from "@core/FileProvider/model/FileProvider";
import type Path from "@core/FileProvider/Path/Path";
import { PluginsAsset } from "./PluginsAsset";

describe("PluginsAsset", () => {
	test("lists only plugin directories", async () => {
		const fp = {
			exists: async () => true,
			readdir: async () => [".DS_Store", "branch-checkout-guard"],
			isFolder: async (path: Path) => path.value.endsWith("branch-checkout-guard"),
		} as unknown as FileProvider;

		await expect(new PluginsAsset(fp).listIds()).resolves.toEqual(["branch-checkout-guard"]);
	});
});
