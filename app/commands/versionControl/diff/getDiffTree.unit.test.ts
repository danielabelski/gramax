import getDiffTree from "./getDiffTree";

const setup = (catalog: unknown) => {
	const workspace = { getContextlessCatalog: jest.fn().mockResolvedValue(catalog), getFileStructure: jest.fn() };
	Reflect.set(getDiffTree, "_app", {
		wm: { current: () => workspace },
		sitePresenterFactory: { fromContext: jest.fn() },
		parser: {},
		parserContextFactory: {},
	});
	return workspace;
};

describe("versionControl/diff/getDiffTree command", () => {
	const ctx = {} as never;

	it("returns an empty diff instead of throwing when the catalog can't be resolved", async () => {
		// A still-mounted revisions-compare view can fire this after navigating to a page whose
		// catalog no longer resolves, sending catalogName: null. That used to hit `assert(catalog)`
		// and crash with `ERR_ASSERTION: undefined == true` (reported via app logs, "Каталог не
		// найден" screen). getContextlessCatalog(null) legitimately resolves to undefined here —
		// treat it as "nothing to diff", matching the `statuses` command's convention.
		setup(undefined);

		const result = await getDiffTree.do({
			ctx,
			catalogName: null as unknown as string,
			oldScope: { commit: "8f0855c4bfa19bec35b48107c22c23172a3bfb4e" },
			newScope: { commit: "8f528582e5e791d1660f35f7888485d76592ea9b" },
		});

		expect(result).toEqual({ data: [], overview: {}, mergeBase: "" });
	});
});
