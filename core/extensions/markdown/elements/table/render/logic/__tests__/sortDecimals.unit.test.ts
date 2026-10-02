import { type SortRecord, SortState, type TableDataExtended } from "@ext/markdown/elements/table/edit/model/tableTypes";
import { getRowMoves } from "@ext/markdown/elements/table/render/logic/sortFilterUtilsRender";

const makeTableData = (values: string[]): TableDataExtended => {
	const rows = [["Value"], ...values.map((value) => [value])].map((cells, rowIndex) => ({
		cells: cells.map((text, colIndex) => ({
			text,
			rowspan: 1,
			colspan: 1,
			realRowStart: rowIndex,
			visualColStart: colIndex,
			realColStart: colIndex,
		})),
	}));

	return { rows, numRows: rows.length } as unknown as TableDataExtended;
};

const sortedValues = (values: string[], direction: SortState) => {
	const tableData = makeTableData(values);
	const moves = getRowMoves(tableData, { 0: direction } as SortRecord, [0]);

	const result: string[] = [];
	values.forEach((value, i) => {
		const oldIndex = i + 1;
		result[(moves[oldIndex] ?? oldIndex) - 1] = value;
	});
	return result;
};

describe("getRowMoves orders numeric columns as numbers", () => {
	test("decimals below one sort ascending by value, not by digit run", () => {
		expect(sortedValues(["0.2", "0.1", "0.03"], SortState.ASC)).toEqual(["0.03", "0.1", "0.2"]);
	});

	test("decimals below one sort descending by value", () => {
		expect(sortedValues(["0.2", "0.1", "0.03"], SortState.DESC)).toEqual(["0.2", "0.1", "0.03"]);
	});

	test("comma is accepted as a decimal separator", () => {
		expect(sortedValues(["0,2", "0,1", "0,03"], SortState.ASC)).toEqual(["0,03", "0,1", "0,2"]);
	});

	test("integers keep sorting numerically", () => {
		expect(sortedValues(["10", "9", "100"], SortState.ASC)).toEqual(["9", "10", "100"]);
	});

	test("non-numeric values keep their natural-order comparison", () => {
		expect(sortedValues(["item10", "item9", "item1"], SortState.ASC)).toEqual(["item1", "item9", "item10"]);
	});
});
