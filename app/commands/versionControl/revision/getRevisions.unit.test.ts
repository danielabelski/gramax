import getRevisions from "./getRevisions";

const setup = (catalog: unknown) => {
	const workspace = { getContextlessCatalog: jest.fn().mockResolvedValue(catalog) };
	Reflect.set(getRevisions, "_app", { wm: { current: () => workspace } });
	return workspace;
};

describe("versionControl/revision/getRevisions command", () => {
	it("returns an empty revisions list instead of throwing when the catalog can't be resolved", async () => {
		// Opening the History panel on a page reached via history navigation whose catalog no
		// longer resolves ("Каталог не найден") sends catalogName: null. That used to hit
		// `assert(catalog?.repo?.gvc)` and crash with `ERR_ASSERTION: undefined == true` (reported
		// via app logs). getContextlessCatalog(null) legitimately resolves to undefined here —
		// treat it as "nothing to list", matching `versionControl/diff/getDiffTree`'s convention.
		setup(undefined);

		const result = await getRevisions.do({ catalogName: null as unknown as string, filters: {} });

		expect(result).toEqual({ data: [], reachedFirstCommit: true });
	});
});
