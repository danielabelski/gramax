import type { Locator } from "@playwright/test";
import { editorTest } from "@web/fixtures/editor.fixture";

type TableCellPosition = { rowIndex: number; cellIndex: number };

export interface ResizerFixture {
	getCell: (cell: TableCellPosition) => Locator;
	dragResizer: (deltaX: number, cell: TableCellPosition) => Promise<void>;
	/** Column widths from the table's `<colgroup>`; `null` for a column that carries none. */
	colWidths: () => Promise<(number | null)[]>;
}

export const resizerTest = editorTest.extend<ResizerFixture>({
	getCell: async ({ sharedPage }, use) => {
		const getCell = ({ rowIndex, cellIndex }: TableCellPosition) =>
			sharedPage.getByTestId("table").locator("tbody tr").nth(rowIndex).locator("td").nth(cellIndex);

		await use(getCell);
	},

	colWidths: async ({ editor }, use) => {
		await use(async () => {
			// The editor keeps the resize in memory until a save; without this the read still sees the
			// document as it was before the drag.
			await editor.forceSave();
			const markdown = await editor.markdown();
			const colgroup = markdown.match(/<colgroup>(.*?)<\/colgroup>/s)?.[1] ?? "";
			return [...colgroup.matchAll(/<col(?:\s+width="(\d+)")?\s*\/>/g)].map((m) => (m[1] ? Number(m[1]) : null));
		});
	},

	dragResizer: async ({ getCell }, use) => {
		await use(async (deltaX: number, tableCellPosition: TableCellPosition) => {
			const cell = getCell(tableCellPosition);
			const box = await cell.boundingBox();
			if (!box) return;
			const x = box.x + box.width;
			const y = box.y + box.height / 2;

			await cell.dispatchEvent("mousemove", { clientX: x, clientY: y, pointerId: 1, bubbles: true });
			await cell.dispatchEvent("mousedown", { clientX: x, clientY: y, pointerId: 1, bubbles: true });
			await cell.dispatchEvent("mousemove", { clientX: x + deltaX, clientY: y, pointerId: 1, bubbles: true });
			await cell.dispatchEvent("mouseup", { clientX: x + deltaX, clientY: y, pointerId: 1, bubbles: true });
		});
	},
});
