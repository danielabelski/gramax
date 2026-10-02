import { initBackendModules } from "@app/resolveModule/backend";
import type Context from "@core/Context/Context";
import type { ReadonlyBaseCatalog } from "@core/FileStructue/Catalog/ReadonlyCatalog";
import LastVisited from "@core/SitePresenter/LastVisited";
import ContextMock from "@ext/wordExport/tests/ContextMock";
import CookieMock from "@ext/wordExport/tests/CookieMock";

const catalog = { name: "docs" } as ReadonlyBaseCatalog;

const visitedAt = (pathname: string) => {
	const ctx: Context = { ...ContextMock, cookie: new CookieMock("") };
	new LastVisited(ctx, "workspace").setLastVisitedArticle(catalog, pathname);
	// Read through a fresh instance: the one that wrote the record would answer from its own cache.
	return { ctx, read: () => new LastVisited(ctx, "workspace").getLastVisitedArticle(catalog) };
};

describe("LastVisited", () => {
	beforeAll(() => initBackendModules());
	beforeEach(() => window.sessionStorage.clear());

	test("an article whose address only begins like the renamed one keeps its record", () => {
		const { ctx, read } = visitedAt("docs/guide-2");

		new LastVisited(ctx, "workspace").move(catalog, "docs/guide", "docs/manual");

		expect(read()).toBe("docs/guide-2");
	});

	test("an item leaving the catalog takes the record leading into it", () => {
		const { ctx, read } = visitedAt("docs/guide/install");

		new LastVisited(ctx, "workspace").forget(catalog, "docs/guide");

		expect(read()).toBeUndefined();
	});

	test("an item leaving the catalog leaves the record of another article", () => {
		const { ctx, read } = visitedAt("docs/guide-2");

		new LastVisited(ctx, "workspace").forget(catalog, "docs/guide");

		expect(read()).toBe("docs/guide-2");
	});
});
