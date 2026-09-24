import type FileProvider from "@core/FileProvider/model/FileProvider";
import Cache from "./Cache";

describe("Cache", () => {
	test.each([{ name: "NotFound" }, { code: "NotFound" }, { name: "ENOENT" }, { code: "ENOENT" }])(
		"delete is idempotent for a missing cache file: %o",
		async (error) => {
			const fp = {
				delete: jest.fn().mockRejectedValue(Object.assign(new Error("missing"), error)),
			} as unknown as FileProvider;

			await expect(new Cache(fp).delete("missing.json")).resolves.toBeUndefined();
		},
	);

	test("delete propagates other errors", async () => {
		const error = new Error("permission denied");
		const fp = {
			delete: jest.fn().mockRejectedValue(error),
		} as unknown as FileProvider;

		await expect(new Cache(fp).delete("cache.json")).rejects.toBe(error);
	});
});
