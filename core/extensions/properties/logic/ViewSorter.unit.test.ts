import Style from "@components/HomePage/Cards/model/Style";
import AttributeFormatter from "@ext/markdown/elements/view/render/logic/attributesFormatter";
import type { OrderValue, ProcessedArticle } from "@ext/properties/logic/ViewFilter";
import ViewSorter from "@ext/properties/logic/ViewSorter";
import { PropertyTypes, type ViewRenderGroup } from "@ext/properties/models";

class TestViewSorter extends ViewSorter {
	public sortGroup(groups: ViewRenderGroup[], orderby: OrderValue[], groupName: string) {
		return this._sortGroup(groups, orderby, groupName);
	}

	public sortArticle(articles: ProcessedArticle[], orderby: OrderValue[]) {
		return this._sortArticle(articles, orderby);
	}
}

describe("ViewSorter", () => {
	test("does not throw for legacy orderby entries without values when sorting groups", () => {
		const formatter = new AttributeFormatter();
		const orderby = formatter.parse({ orderby: "status=" }).orderby as OrderValue[];
		const sorter = new TestViewSorter();

		expect(() =>
			sorter.sortGroup(
				[
					{ group: ["B"], articles: [] },
					{ group: ["A"], articles: [] },
				],
				orderby,
				"status",
			),
		).not.toThrow();
	});

	test("falls back to catalog values when enum sorting has no explicit order", () => {
		const sorter = new TestViewSorter();

		expect(
			sorter
				.sortArticle(
					[
						{
							title: "A",
							resourcePath: "./a.md",
							linkPath: "/a",
							itemPath: "a",
							groupValues: [],
							otherProps: [
								{
									id: "status",
									name: "status",
									type: PropertyTypes.enum,
									style: Style.green,
									value: ["done"],
									values: ["todo", "done"],
								},
							],
						},
						{
							title: "B",
							resourcePath: "./b.md",
							linkPath: "/b",
							itemPath: "b",
							groupValues: [],
							otherProps: [
								{
									id: "status",
									name: "status",
									type: PropertyTypes.enum,
									style: Style.green,
									value: ["todo"],
									values: ["todo", "done"],
								},
							],
						},
					],
					[{ id: "status", value: undefined }],
				)
				.map((article) => article.title),
		).toEqual(["B", "A"]);
	});

	const dateArticle = (title: string, value: string[]): ProcessedArticle => ({
		title,
		resourcePath: `./${title}.md`,
		linkPath: `/${title}`,
		itemPath: title,
		groupValues: [],
		otherProps: [
			{
				id: "due",
				name: "due",
				type: PropertyTypes.date,
				style: Style.green,
				value,
			},
		],
	});

	const sortByDue = (articles: ProcessedArticle[]) =>
		new TestViewSorter().sortArticle(articles, [{ id: "due", value: undefined }]).map((article) => article.title);

	test("orders date properties chronologically", () => {
		expect(
			sortByDue([
				dateArticle("C", ["2026-03-01"]),
				dateArticle("A", ["2025-01-05"]),
				dateArticle("B", ["2025-12-31"]),
			]),
		).toEqual(["A", "B", "C"]);
	});

	test("keeps a value Date cannot parse after every real date instead of scattering them", () => {
		expect(
			sortByDue([
				dateArticle("C", ["2026-03-01"]),
				dateArticle("unparseable", ["31.12.2025"]),
				dateArticle("A", ["2025-01-05"]),
			]),
		).toEqual(["A", "C", "unparseable"]);
	});

	test("compares dates consistently, so the result does not depend on the input order", () => {
		const values: Array<[string, string]> = [
			["A", "2025-01-05"],
			["B", "31.12.2025"],
			["C", "2026-03-01"],
			["D", "5 \u044f\u043d\u0432\u0430\u0440\u044f 2025"],
		];
		const first = sortByDue(values.map(([title, value]) => dateArticle(title, [value])));
		const second = sortByDue([...values].reverse().map(([title, value]) => dateArticle(title, [value])));

		expect(second).toEqual(first);
	});
});
