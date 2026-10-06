import ArticleTitleHelpers from "@ext/markdown/elements/article/edit/ArticleTitleHelpers";
import { Extension } from "@tiptap/core";
import withoutInheritedTitleHandler from "./withoutInheritedTitleHandler";

describe("withoutInheritedTitleHandler", () => {
	test("drops the title handler configured for another editor", () => {
		const inherited = ArticleTitleHelpers.configure({ onTitleLoseFocus: jest.fn() });
		const other = Extension.create({ name: "other" });

		expect(withoutInheritedTitleHandler([other, inherited])).toEqual([other]);
	});

	test("keeps every other extension in order", () => {
		const first = Extension.create({ name: "first" });
		const second = Extension.create({ name: "second" });

		expect(withoutInheritedTitleHandler([first, second])).toEqual([first, second]);
	});

	test("does not mutate the shared list", () => {
		const list = [ArticleTitleHelpers, Extension.create({ name: "other" })];

		withoutInheritedTitleHandler(list);

		expect(list).toHaveLength(2);
	});
});
