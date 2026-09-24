import Path from "@core/FileProvider/Path/Path";
import getAllComments from "./getAll";

describe("comments/getAll command", () => {
	const ctx = { contentLanguage: "ru" } as never;

	it("returns an empty map when the article is not found (stale request after rename/delete)", async () => {
		const getAll = jest.fn();
		const catalog = {
			props: { language: "ru" },
			findItemByItemPath: jest.fn().mockReturnValue(undefined),
			customProviders: { commentProvider: { getAllComments: getAll } },
		};
		const workspace = { getCatalog: jest.fn().mockResolvedValue(catalog) };

		Reflect.set(getAllComments, "_app", {
			wm: { current: () => workspace },
			parserContextFactory: { fromArticle: jest.fn() },
		});

		const result = await getAllComments.do({
			ctx,
			catalogName: "new-catalog",
			articlePath: new Path("new-catalog/untitled.md"),
		});

		expect(result).toEqual({});
		expect(getAll).not.toHaveBeenCalled();
	});
});
