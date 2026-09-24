import { ContentLanguage } from "@ext/localization/core/model/Language";
import { buildSearchParams, canSearch, canUsePropertyFilter } from "@ext/serach/components/model/searchParams";
import { makeParams, makeParamsInput, makeSelectedProperty } from "./fixtures";

describe("canUsePropertyFilter", () => {
	it("allows only catalog mode with a narrowed scope and no ai", () => {
		expect(canUsePropertyFilter("catalog", "catalog", false)).toBe(true);
		expect(canUsePropertyFilter("catalog", "article", false)).toBe(true);
		expect(canUsePropertyFilter("catalog", "all", false)).toBe(false);
		expect(canUsePropertyFilter("section", "folder", false)).toBe(false);
		expect(canUsePropertyFilter("homepage", "all", false)).toBe(false);
		expect(canUsePropertyFilter("catalog", "catalog", true)).toBe(false);
	});
});

describe("buildSearchParams", () => {
	it("builds catalog-scoped params", () => {
		expect(buildSearchParams(makeParamsInput())).toEqual({
			aiEnabled: false,
			catalogName: "docs",
			catalogNames: undefined,
			articleRefFilter: undefined,
			articlesLanguage: "none",
			responseLanguage: undefined,
			onlyArticles: true,
			resourceFilter: undefined,
			propertyFilter: undefined,
		});
	});

	describe("scope", () => {
		it("drops the catalog name and article-only mode when searching everywhere", () => {
			const params = buildSearchParams(makeParamsInput({ scope: "all" }));

			expect(params.catalogName).toBeUndefined();
			expect(params.onlyArticles).toBe(false);
			expect(params.articlesLanguage).toBeUndefined();
		});

		it("filters by the current article ref only in article scope", () => {
			const input = makeParamsInput({ currentArticleRefPath: "docs/a.md" });

			expect(buildSearchParams({ ...input, scope: "article" }).articleRefFilter).toBe("docs/a.md");
			expect(buildSearchParams({ ...input, scope: "catalog" }).articleRefFilter).toBeUndefined();
		});

		it("passes section catalog names only in folder scope", () => {
			const input = makeParamsInput({ mode: "section", sectionCatalogNames: ["a", "b"] });

			expect(buildSearchParams({ ...input, scope: "folder" }).catalogNames).toEqual(["a", "b"]);
			expect(buildSearchParams({ ...input, scope: "all" }).catalogNames).toBeUndefined();
		});
	});

	describe("languages", () => {
		it("prefers the current article language over the catalog default", () => {
			const params = buildSearchParams(
				makeParamsInput({
					currentArticleLanguage: ContentLanguage.ru,
					catalogDefaultLanguage: ContentLanguage.en,
				}),
			);

			expect(params.articlesLanguage).toBe("ru");
		});

		it("falls back to the catalog default, then to none", () => {
			expect(
				buildSearchParams(makeParamsInput({ catalogDefaultLanguage: ContentLanguage.en })).articlesLanguage,
			).toBe("en");
			expect(buildSearchParams(makeParamsInput()).articlesLanguage).toBe("none");
		});

		it("has no articles language without a catalog", () => {
			expect(buildSearchParams(makeParamsInput({ catalogName: undefined })).articlesLanguage).toBeUndefined();
		});

		it("sets a response language only for chat, and never falls back to none", () => {
			const input = makeParamsInput({ catalogDefaultLanguage: ContentLanguage.en });

			expect(buildSearchParams({ ...input, aiEnabled: true }).responseLanguage).toBe("en");
			expect(buildSearchParams(input).responseLanguage).toBeUndefined();
			expect(
				buildSearchParams({ ...input, aiEnabled: true, catalogDefaultLanguage: undefined }).responseLanguage,
			).toBeUndefined();
		});
	});

	describe("resource filter", () => {
		it("is sent only when resources search is enabled and ai is off", () => {
			const input = makeParamsInput({ resourcesEnabled: true, resourceFilter: "only" });

			expect(buildSearchParams(input).resourceFilter).toBe("only");
			expect(buildSearchParams({ ...input, aiEnabled: true }).resourceFilter).toBeUndefined();
			expect(buildSearchParams({ ...input, resourcesEnabled: false }).resourceFilter).toBeUndefined();
		});
	});

	describe("property filter", () => {
		it("builds a filter from the selected properties", () => {
			const params = buildSearchParams(
				makeParamsInput({ selectedProperties: [makeSelectedProperty("status", ["a"])] }),
			);

			expect(params.propertyFilter).toEqual({
				op: "and",
				filters: [{ op: "contains", key: "status", list: ["a"] }],
			});
		});

		it("is dropped where the filter cannot apply", () => {
			const input = makeParamsInput({ selectedProperties: [makeSelectedProperty("status", ["a"])] });

			expect(buildSearchParams({ ...input, scope: "all" }).propertyFilter).toBeUndefined();
			expect(buildSearchParams({ ...input, aiEnabled: true }).propertyFilter).toBeUndefined();
		});

		it("is undefined when nothing is selected", () => {
			expect(buildSearchParams(makeParamsInput()).propertyFilter).toBeUndefined();
		});
	});

	it("carries the ai toggle through", () => {
		expect(buildSearchParams(makeParamsInput({ aiEnabled: true })).aiEnabled).toBe(true);
		expect(buildSearchParams(makeParamsInput()).aiEnabled).toBe(false);
	});
});

describe("canSearch", () => {
	it("needs a query or a property filter", () => {
		expect(canSearch(makeParams(), "q")).toBe(true);
		expect(canSearch(makeParams(), "")).toBe(false);
		expect(canSearch(makeParams({ propertyFilter: { op: "isEmpty", key: "status" } }), "")).toBe(true);
	});
});
