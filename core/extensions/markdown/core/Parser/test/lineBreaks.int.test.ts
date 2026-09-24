import { getParserTestData } from "./getParserTestData";

const roundTrip = async (markdown: string): Promise<string> => {
	const { parser, parseContext, formatter } = await getParserTestData();
	const content = await parser.parse(markdown, parseContext, "requestURL.com");
	return formatter.render(content.editTree, parseContext);
};

const renderHtml = async (markdown: string): Promise<string> => {
	const { parser, parseContext } = await getParserTestData();
	const content = await parser.parse(markdown, parseContext, "requestURL.com");
	const html = parser.getHtml(content.renderTree, parseContext, "requestURL.com");
	return /<article>([\s\S]*?)<\/article>/gm.exec(html)?.[1] ?? "";
};

describe("line breaks in a paragraph survive the parse -> format round trip", () => {
	test("soft break stays a soft break", async () => {
		expect(await roundTrip("A\nB")).toBe("A\nB");
	});

	test("two-space hard break becomes a backslash hard break", async () => {
		expect(await roundTrip("A  \nB")).toBe("A\\\nB");
	});

	test("backslash hard break stays a backslash hard break", async () => {
		expect(await roundTrip("A\\\nB")).toBe("A\\\nB");
	});

	test("blank line stays a paragraph border", async () => {
		expect(await roundTrip("A\n\nB")).toBe("A\n\nB");
	});
});

describe("line breaks in a list item survive the parse -> format round trip", () => {
	test("soft break stays a soft break", async () => {
		expect(await roundTrip("-  A\n   B")).toBe("-  A\n   B");
	});

	test("two-space hard break becomes a backslash hard break", async () => {
		expect(await roundTrip("-  A  \n   B")).toBe("-  A\\\n   B");
	});

	test("backslash hard break stays a backslash hard break", async () => {
		expect(await roundTrip("-  A\\\n   B")).toBe("-  A\\\n   B");
	});

	test("blank line stays a paragraph border inside the item", async () => {
		expect(await roundTrip("-  A\n\n   B")).toBe("-  A\n\n   B");
	});
});

describe("soft break renders as a space, matching CommonMark", () => {
	test("paragraph html has no br", async () => {
		expect(await renderHtml("A\nB")).toBe("<p>A B</p>");
	});
});
