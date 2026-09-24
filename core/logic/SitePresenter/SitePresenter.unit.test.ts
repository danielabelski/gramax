/**
 * @jest-environment node
 */
import { ItemType } from "@core/FileStructue/Item/ItemType";
import { ContentLanguage } from "@ext/localization/core/model/Language";
import { WorkspaceView } from "@ext/workspace/WorkspaceConfig";
import SitePresenter from "./SitePresenter";

jest.mock("@core/SitePresenter/LastVisited", () =>
	jest.fn().mockImplementation(() => ({
		retain: jest.fn(),
	})),
);

// Reproduces the multilingual crash class behind GitHub #177: when the requested
// non-default language subtree cannot be resolved (e.g. a broken/missing default
// article leaves the `<catalog>/<lang>` category unbuilt), `resolveRootCategory`
// returns undefined and `getArticleByPathOfCatalog` dereferences it unguarded
// (`!root.parent`) -> TypeError. Every other consumer of `resolveRootCategory`
// guards the nullable result (`?.` / `if (!root) return`); this one did not.

const CATALOG_NAME = "test-catalog";

const makeCatalog = () => {
	const rootCategory = { parent: undefined, items: [], props: {} };
	const article = {
		type: ItemType.article,
		logicPath: `${CATALOG_NAME}/en/article`,
		props: {},
	};

	const catalog = {
		name: CATALOG_NAME,
		props: {
			language: ContentLanguage.ru,
			supportedLanguages: [ContentLanguage.ru, ContentLanguage.en],
			resolvedView: null,
		},
		getRootCategory: () => rootCategory,
		findArticle: (logicPath: string) => {
			// The language-category lookup (`<catalog>/<lang>`) cannot be resolved.
			if (logicPath === `${CATALOG_NAME}/en`) return undefined;
			return article;
		},
	};

	return { catalog, article, rootCategory };
};

const makePresenter = (catalog: unknown): SitePresenter => {
	const sp = Object.create(SitePresenter.prototype);
	sp._workspace = { getCatalog: async () => catalog };
	sp._context = { contentLanguage: ContentLanguage.en };
	sp._filters = [];
	return sp;
};

const makeHomePresenter = (catalogLinks: { name: string }[]): SitePresenter => {
	const presenter = Object.create(SitePresenter.prototype) as SitePresenter;
	Reflect.set(presenter, "_workspace", {
		getAllCatalogs: () => new Map(catalogLinks.map((link) => [link.name, {}])),
	});
	Reflect.set(presenter, "_nav", { getCatalogsLink: async () => catalogLinks });
	Reflect.set(presenter, "_context", { cookie: { get: () => undefined, set: jest.fn() } });
	return presenter;
};

describe("SitePresenter.getArticleByPathOfCatalog", () => {
	test("degrades gracefully when the language category is unresolvable (#177)", async () => {
		const { catalog, article } = makeCatalog();
		const sp = makePresenter(catalog);

		const result = await sp.getArticleByPathOfCatalog([CATALOG_NAME, "en", "article"]);

		expect(result.catalog).toBe(catalog);
		expect(result.article).toBe(article);
	});
});

describe("SitePresenter.getHomePageData", () => {
	test("resolves global and personal homepage views independently", async () => {
		const catalogLinks = [
			{ name: "global-catalog", group: "", title: "Global catalog" },
			{ name: "personal-catalog", group: "", title: "Personal catalog" },
		];
		const presenter = makeHomePresenter(catalogLinks);

		const data = await presenter.getHomePageData({
			name: "Workspace",
			sections: {
				global: { title: "Global", view: WorkspaceView.section, catalogs: ["global-catalog"] },
			},
			personalSections: {
				personal: { title: "Personal", view: WorkspaceView.section, catalogs: ["personal-catalog"] },
			},
		});

		expect(Object.keys(data.views.global.section.sections)).toEqual(["global"]);
		expect(Object.keys(data.views.personal.section.sections)).toEqual(["personal"]);
	});

	test("personal view inherits global sections without an override", async () => {
		const catalogLinks = [{ name: "guide", group: "", title: "Guide" }];
		const presenter = makeHomePresenter(catalogLinks);

		const data = await presenter.getHomePageData({
			name: "Workspace",
			sections: { docs: { title: "Docs", view: WorkspaceView.section, catalogs: ["guide"] } },
		});

		expect(data.views.personal).toEqual(data.views.global);
	});

	test("keeps root views when the current route points to a homepage folder", async () => {
		const catalogLinks = [{ name: "guide", group: "", title: "Guide" }];
		const presenter = makeHomePresenter(catalogLinks);

		const data = await presenter.getHomePageData(
			{
				name: "Workspace",
				sections: { resources: { title: "Resources", view: WorkspaceView.folder, catalogs: ["guide"] } },
			},
			"/home/resources",
		);

		expect(data.views.global.section.title).toBe("Resources");
		expect(data.rootSections).toBeDefined();
		expect(Object.keys(data.rootSections!.global.sections)).toEqual(["resources"]);
	});
});
