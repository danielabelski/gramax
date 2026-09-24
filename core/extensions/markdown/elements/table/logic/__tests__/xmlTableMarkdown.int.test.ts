import { getParserTestData } from "@ext/markdown/core/Parser/test/getParserTestData";

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };

const parse = async (markdown: string) => {
	const { parser, parseContext } = await getParserTestData();
	const content = await parser.parse(markdown, parseContext, "requestURL.com");
	return (content.editTree as unknown as Node).content?.[0];
};

const cellTexts = (row: Node) =>
	row.content.map((cell) =>
		cell.content
			.flatMap((block) => block.content ?? [])
			.map((inline) => inline.text ?? "")
			.join(""),
	);

describe("xml table markdown", () => {
	it("parses a table written with several tags on one line", async () => {
		const table = await parse(`<table><tr><td>a</td><td>b</td></tr></table>\n`);

		expect(table.type).toBe("table");
		expect(table.content).toHaveLength(1);
		expect(cellTexts(table.content[0])).toEqual(["a", "b"]);
	});

	it("keeps colgroup widths when the opening tag shares its line with the colgroup", async () => {
		const table = await parse(
			`<table header="both"><colgroup><col width="180" /><col width="220" /></colgroup>\n<tr><td>a</td><td>b</td></tr>\n</table>\n`,
		);

		expect(table.attrs.header).toBe("both");
		expect(table.content[0].content.map((cell) => cell.attrs.colwidth)).toEqual([[180], [220]]);
	});

	// gh#944: rowspan plus a colspan cell whose content is indented past a blank line used to
	// throw out of the token transform and leave the article stuck on the loading spinner.
	it("parses merged cells next to an indented multi-paragraph cell", async () => {
		const table =
			await parse(`<table header="both"><colgroup><col width="180" /><col width="220" /><col /></colgroup>
  <tr><td>Группа</td><td>Элемент</td><td>Пример</td></tr>
  <tr><td rowspan="2">Inline</td><td>Код</td><td>\`const value = 42\`</td></tr>
  <tr><td>Выделение</td><td>**Важный текст**</td></tr>
  <tr><td>Block</td><td colspan="2">Объединённая ячейка</td></tr>
  <tr>
    <td>Многоабзацная</td>
    <td colspan="2">
      Первый абзац ячейки.

      Второй абзац той же ячейки.
    </td>
  </tr>
</table>
`);

		expect(table.type).toBe("table");
		expect(table.content).toHaveLength(5);
		expect(table.content[1].content[0].attrs.rowspan).toBe(2);
		expect(table.content[3].content[1].attrs.colspan).toBe(2);
		// The indented lines are a Markdown code block; the row keeps them instead of failing.
		expect(JSON.stringify(table.content[4])).toContain("Второй абзац той же ячейки");
	});

	it("survives a closing tag that has no opening tag", async () => {
		const { parser, parseContext } = await getParserTestData();

		await expect(parser.parse(`text\n\n</table>\n`, parseContext, "requestURL.com")).resolves.toBeDefined();
	});
});
