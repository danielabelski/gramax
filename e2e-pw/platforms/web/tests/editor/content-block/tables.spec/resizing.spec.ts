import { expect } from "@playwright/test";
import { md } from "@utils/utils";
import { resizerTest } from "@web/tests/editor/content-block/tables.spec/resizer.fixture";

/**
 * The widths a drag produces depend on how wide the editor renders, and that differs between a CI
 * container and a developer's screen — the same table is 730px wide there and 741px here. Pinning
 * the exact numbers made these tests pass in exactly one environment.
 *
 * What the drag actually promises holds everywhere: the column left of the handle grows by the
 * distance dragged at its neighbour's expense, and columns that already carried a width keep it.
 */
const DRAG = 100;
const TOLERANCE = 10;
/** How far the dragged column ends up ahead of the flexible one that pays for it. */
const SPREAD = 55;

resizerTest.describe("Table resizing", () => {
	resizerTest("resize simple table", async ({ editor, dragResizer, colWidths }) => {
		await editor.setMarkdown(md`
			||||
			|-|-|-|
			||||
			||||
		`);

		await dragResizer(DRAG, { cellIndex: 1, rowIndex: 1 });

		const widths = await colWidths();
		expect(widths).toHaveLength(3);
		expect(widths.every((w) => typeof w === "number")).toBe(true);

		// The two columns the drag never touched stay equal to each other...
		expect(widths[0]).toBe(widths[2]);
		// ...and the dragged one ends up wider by the distance dragged.
		expect(widths[1]! - widths[0]!).toBeGreaterThanOrEqual(DRAG - TOLERANCE);
		expect(widths[1]! - widths[0]!).toBeLessThanOrEqual(DRAG + TOLERANCE);

		// The table survives the resize as a table.
		await editor.assertMarkdownContains('<table header="row">');
	});

	resizerTest("resize table with empty and filled colWidth", async ({ editor, dragResizer, colWidths }) => {
		await editor.setMarkdown(
			'<table header="row">\n<colgroup><col width="161"/><col/><col width="223"/><col/></colgroup>\n<tr>\n<td>\n\nНаименование\n\n</td>\n<td>\n\nТип данных\n\n</td>\n<td>\n\nОбязательное поле\n\n</td>\n<td>\n\nКомментарий\n\n</td>\n</tr>\n<tr>\n<td>\n\nid\n\n</td>\n<td>\n\n`integer`\n\n</td>\n<td>\n\nДа\n\n</td>\n<td>\n\nId  отсутствия\n\n</td>\n</tr>\n<tr>\n<td>\n\nabsenceReason\n\n</td>\n<td>\n\n`nvarchar(500)`\n\n</td>\n<td>\n\nДа\n\n</td>\n<td>\n\nПричина отсутствия\n\n</td>\n</tr>\n<tr>\n<td>\n\nstatusId\n\n</td>\n<td>\n\n`nvarchar(50)`\n\n</td>\n<td>\n\nНет\n\n</td>\n<td>\n\nСсылка на статус\n\n</td>\n</tr>\n</table>',
		);

		await dragResizer(DRAG, { cellIndex: 1, rowIndex: 1 });

		const widths = await colWidths();
		expect(widths).toHaveLength(4);
		expect(widths.every((w) => typeof w === "number")).toBe(true);

		// Columns that came in with a width of their own are left alone.
		expect(widths[0]).toBe(161);
		expect(widths[2]).toBe(223);

		// The drag widens the column it grabbed, and the only other flexible column pays for it.
		expect(widths[1]!).toBeGreaterThan(widths[3]!);
		expect(widths[1]! - widths[3]!).toBeGreaterThanOrEqual(SPREAD - TOLERANCE);
		expect(widths[1]! - widths[3]!).toBeLessThanOrEqual(SPREAD + TOLERANCE);

		// The cells keep their content through the resize.
		await editor.assertMarkdownContains("Наименование");
		await editor.assertMarkdownContains("Ссылка на статус");
	});
});
