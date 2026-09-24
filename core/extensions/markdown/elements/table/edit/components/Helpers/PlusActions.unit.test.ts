import { fireEvent, render } from "@testing-library/react";
import PlusActions from "./PlusActions";

jest.mock("@components/Atoms/Icon", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: () => null,
}));

const React = require("react");

const renderPlusAction = (table: HTMLElement) =>
	render(
		React.createElement(PlusActions, {
			tableRef: { current: table },
			onClick: () => {},
			dataQa: "plus-action",
			index: 0,
		}),
	);

describe("PlusActions", () => {
	it("does not crash on hover when the table has no `> tbody > tr` row", () => {
		// A diff-rendered / emptied table exposes no direct-child row: `querySelector` returns null.
		const table = document.createElement("table");

		const { getByTestId } = renderPlusAction(table);

		expect(() => fireEvent.mouseEnter(getByTestId("plus-action"))).not.toThrow();
	});

	it("computes the hover preview when the table has a row", () => {
		const table = document.createElement("table");
		table.innerHTML = "<tbody><tr><td>cell</td></tr></tbody>";

		const { getByTestId } = renderPlusAction(table);

		expect(() => fireEvent.mouseEnter(getByTestId("plus-action"))).not.toThrow();
	});
});
