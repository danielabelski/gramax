import { buildElementTextIndex } from "@components/Article/SearchHandler/ArticleSearchFragmentHander";

describe("buildElementTextIndex", () => {
	test("excludes SVG text from ancestor text", () => {
		const root = document.createElement("div");
		root.innerHTML = "<svg><text>needle</text></svg><p>needle</p>";

		const index = buildElementTextIndex(root);

		expect(index.get(root)?.match(/needle/g)).toHaveLength(1);
	});

	test("separates block children without splitting inline text", () => {
		const root = document.createElement("div");
		root.innerHTML = "<h2>Настройка</h2><p>сервера</p><p>тест<strong>овый</strong></p>";
		const inlineParagraph = root.lastElementChild;

		const index = buildElementTextIndex(root);

		expect(index.get(root)).not.toContain("Настройкасервера");
		expect(index.get(inlineParagraph)).toBe("тестовый");
	});
});
