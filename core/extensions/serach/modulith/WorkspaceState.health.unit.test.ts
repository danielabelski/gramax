import { WorkspaceState } from "./WorkspaceState";

describe("WorkspaceState search health", () => {
	it("tracks indexing lifecycle and recovery per workspace", () => {
		const state = new WorkspaceState("workspace" as never, false);

		expect(state.getSearchHealth(["docs"])).toEqual({ phase: "no-data" });

		state.startCatalogHealthcheck("docs");
		expect(state.getSearchHealth(["docs"])).toMatchObject({ phase: "indexing" });

		state.markCatalogIndexingFailed("docs");
		expect(state.getSearchHealth(["docs"])).toEqual({ phase: "failed" });

		state.startCatalogHealthcheck("docs");
		state.markIndexedCatalog("docs");
		expect(state.getSearchHealth(["docs"])).toEqual({ phase: "ready" });
	});

	it("compares catalog names instead of catalog counts", () => {
		const state = new WorkspaceState("workspace" as never, false);
		state.startCatalogHealthcheck("old");
		state.markIndexedCatalog("old");

		expect(state.getSearchHealth(["new"])).toMatchObject({ phase: "indexing" });
	});

	it("reports indexing while an already indexed catalog is being reindexed", () => {
		const state = new WorkspaceState("workspace" as never, false);
		state.markIndexedCatalog("docs");
		state.startCatalogHealthcheck("docs");

		expect(state.getSearchHealth(["docs"])).toMatchObject({ phase: "indexing" });
	});
});
