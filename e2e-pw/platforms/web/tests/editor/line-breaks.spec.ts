import { md } from "@utils/utils";
import { editorTest } from "@web/fixtures/editor.fixture";
import { expect } from "playwright/test";

editorTest.describe("Line breaks", () => {
	editorTest("Shift+Enter breaks a line inside a paragraph", async ({ editor }) => {
		await editor.type("Первая строка.");
		await editor.press("Shift+Enter");
		await editor.type("Вторая строка.");

		await editor.assertMarkdown(md`
			Первая строка.\\
			Вторая строка.
		`);
		await expect(editor.body.locator("p br:not(.ProseMirror-trailingBreak)")).toHaveCount(1);
	});

	editorTest("Shift+Enter breaks a line inside a list item, keeping a single item", async ({ editor }) => {
		await editor.setMarkdown("-  Первая строка.(*)");
		await editor.press("Shift+Enter");
		await editor.type("Вторая строка.");

		await editor.assertMarkdown(md`
			-  Первая строка.\\
			   Вторая строка.
		`);
		await expect(editor.body.locator("li")).toHaveCount(1);
	});

	editorTest("soft line breaks from the file survive an edit", async ({ editor }) => {
		await editor.setMarkdown("Каталог синхронизируется.\nПравки публикуются.(*)\nКонфликты решаются в окне.");
		await editor.type(" Оперативно.");

		await editor.assertMarkdown(md`
			Каталог синхронизируется.
			Правки публикуются. Оперативно.
			Конфликты решаются в окне.
		`);
	});
});
