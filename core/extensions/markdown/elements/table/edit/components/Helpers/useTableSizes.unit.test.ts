import { act, renderHook } from "@testing-library/react";
import useTableSizes from "./useTableSizes";

class MockResizeObserver {
	static instances: MockResizeObserver[] = [];
	observed: Element[] = [];
	constructor(public callback: () => void) {
		MockResizeObserver.instances.push(this);
	}
	observe(element: Element) {
		this.observed.push(element);
	}
	disconnect() {
		this.observed = [];
	}
	unobserve() {}
}

const makeTable = () => {
	const table = document.createElement("table");
	table.appendChild(document.createElement("colgroup"));
	table.appendChild(document.createElement("thead"));
	document.body.appendChild(table);
	return table;
};

const makeBody = (cellCount: number) => {
	const body = document.createElement("tbody");
	const row = document.createElement("tr");
	for (let i = 0; i < cellCount; i++) row.appendChild(document.createElement("td"));
	body.appendChild(row);
	return body;
};

const flushMutations = async () => {
	await act(async () => {
		await Promise.resolve();
	});
};

describe("useTableSizes", () => {
	beforeEach(() => {
		MockResizeObserver.instances = [];
		(global as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("measures a table that already has its rows", () => {
		const table = makeTable();
		table.appendChild(makeBody(2));

		const { result } = renderHook(() => useTableSizes({ current: table }));

		expect(result.current.tableSizes.cols).toHaveLength(2);
		expect(result.current.tableSizes.rows).toHaveLength(1);
	});

	// gh#942: ProseMirror fills the tbody in after the node view mounts when the table sits inside
	// another node view. The sizes stayed empty, so the controls grid was 0px and the add-row,
	// add-column and "..." buttons had no size to be clicked on.
	it("measures the table once the tbody appears", async () => {
		const table = makeTable();
		const { result } = renderHook(() => useTableSizes({ current: table }));

		expect(result.current.tableSizes.cols).toHaveLength(0);

		table.appendChild(makeBody(3));
		await flushMutations();

		expect(result.current.tableSizes.cols).toHaveLength(3);
		expect(result.current.tableSizes.rows).toHaveLength(1);
	});

	it("keeps measuring after the tbody is replaced", async () => {
		const table = makeTable();
		table.appendChild(makeBody(2));
		const { result } = renderHook(() => useTableSizes({ current: table }));

		table.removeChild(table.tBodies[0]);
		table.appendChild(makeBody(4));
		await flushMutations();

		expect(result.current.tableSizes.cols).toHaveLength(4);
	});

	it("reports a row added to the tbody", async () => {
		const table = makeTable();
		const body = makeBody(2);
		table.appendChild(body);
		const onChangeChildCount = jest.fn();
		const { result } = renderHook(() => useTableSizes({ current: table }, onChangeChildCount));

		const row = document.createElement("tr");
		row.appendChild(document.createElement("td"));
		row.appendChild(document.createElement("td"));
		body.appendChild(row);
		await flushMutations();

		expect(result.current.tableSizes.rows).toHaveLength(2);
		expect(onChangeChildCount).toHaveBeenCalled();
	});
});
