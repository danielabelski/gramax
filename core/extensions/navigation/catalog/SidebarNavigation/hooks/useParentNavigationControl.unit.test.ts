import { useParentNavigationControl } from "@ext/navigation/catalog/SidebarNavigation/hooks/useParentNavigationControl";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, useRef } from "react";

const Control = ({ forceActive = false }: { forceActive?: boolean }) => {
	const markerRef = useRef<HTMLSpanElement>(null);
	const active = useParentNavigationControl(markerRef, forceActive);

	return createElement(
		"div",
		{ "data-testid": "row" },
		createElement("span", { ref: markerRef }, active ? createElement("span", { "data-testid": "control" }) : null),
	);
};

describe("useParentNavigationControl", () => {
	test("keeps the control unmounted while its row is idle", () => {
		render(createElement(Control));

		expect(screen.queryByTestId("control")).toBeNull();
	});

	test("mounts the control while its row is hovered", () => {
		render(createElement(Control));

		fireEvent.pointerEnter(screen.getByTestId("row"));

		expect(screen.queryByTestId("control")).not.toBeNull();
	});

	test("unmounts the control after the pointer leaves its row", () => {
		render(createElement(Control));
		const row = screen.getByTestId("row");

		fireEvent.pointerEnter(row);
		fireEvent.pointerLeave(row);

		expect(screen.queryByTestId("control")).toBeNull();
	});

	test("mounts the control while focus is inside its row", () => {
		render(createElement(Control));

		fireEvent.focusIn(screen.getByTestId("row"));

		expect(screen.queryByTestId("control")).not.toBeNull();
	});

	test("keeps the control mounted when an external state requires it", () => {
		render(createElement(Control, { forceActive: true }));

		fireEvent.pointerLeave(screen.getByTestId("row"));

		expect(screen.queryByTestId("control")).not.toBeNull();
	});
});
