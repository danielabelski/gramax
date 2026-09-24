import matchesDiffArticle from "./matchesDiffArticle";

describe("matchesDiffArticle", () => {
	test("совпадающие пути проходят", () => {
		expect(
			matchesDiffArticle(
				"docs/docs/catalog/settings/main-parameters.md",
				"docs/docs/catalog/settings/main-parameters.md",
			),
		).toBe(true);
	});

	test("скоуп в корневом сегменте не мешает совпадению", () => {
		expect(
			matchesDiffArticle(
				"docs:HEAD/docs/catalog/settings/main-parameters.md",
				"docs/docs/catalog/settings/main-parameters.md",
			),
		).toBe(true);
	});

	test("статья другого языка не проходит", () => {
		// Ровно случай потери данных: в редакторе открыт en/app/settings, а сохранение целится
		// в русский main-parameters.
		expect(
			matchesDiffArticle("docs/docs/catalog/settings/main-parameters.md", "docs/docs/en/app/settings/_index.md"),
		).toBe(false);
	});

	test("пустой путь не проходит", () => {
		expect(matchesDiffArticle("", "docs/docs/catalog/settings/main-parameters.md")).toBe(false);
		expect(matchesDiffArticle("docs/docs/catalog/settings/main-parameters.md", undefined)).toBe(false);
	});
});
