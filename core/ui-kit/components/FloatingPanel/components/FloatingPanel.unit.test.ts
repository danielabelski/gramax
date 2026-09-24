import { act, fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement, Fragment, useState } from "react";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import { FloatingPanel } from "./FloatingPanel";
import { PanelWindow } from "./PanelWindow";

describe("FloatingPanel", () => {
	beforeEach(() => {
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
	});

	it.each(["content", "header"])("raises a panel when pressing its portaled %s", (slot) => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(
					Fragment,
					null,
					...["first", "second"].map((id) =>
						createElement(FloatingPanel, {
							id,
							key: id,
							title: id,
							headerActions: createElement("button", { type: "button" }, `${id} header`),
							// biome-ignore lint/correctness/noChildrenProp: expected
							children: createElement("button", { type: "button" }, `${id} content`),
						}),
					),
					createElement(PanelWindow, { id: "first" }),
					createElement(PanelWindow, { id: "second" }),
				),
			),
		);
		act(() => {
			useFloatingPanelStore.getState().setIsOpen("first", true);
			useFloatingPanelStore.getState().setIsOpen("second", true);
		});
		const first = screen.getByRole("dialog", { name: "first" }).parentElement!;
		const second = screen.getByRole("dialog", { name: "second" }).parentElement!;
		expect(Number(first.style.zIndex)).toBeLessThan(Number(second.style.zIndex));

		const target = screen.getByText(`first ${slot}`);
		target.addEventListener("pointerdown", (event) => event.stopPropagation());
		fireEvent.pointerDown(target);
		fireEvent.mouseDown(target);

		expect(Number(first.style.zIndex)).toBeGreaterThan(Number(second.style.zIndex));

		fireEvent.pointerDown(screen.getByText(`second ${slot}`));
		expect(Number(second.style.zIndex)).toBeGreaterThan(Number(first.style.zIndex));

		fireEvent.pointerDown(target);
		expect(Number(first.style.zIndex)).toBeGreaterThan(Number(second.style.zIndex));
	});

	it("preserves content state when the panel moves to another slot", () => {
		const floatingSlot = document.createElement("div");
		const dockedSlot = document.createElement("div");
		document.body.append(floatingSlot, dockedSlot);
		useFloatingPanelStore.getState().setPanelSlot("test-panel", "content", floatingSlot);

		const view = render(
			createElement(FloatingPanel, {
				id: "test-panel",
				title: "Test panel",
				// biome-ignore lint/correctness/noChildrenProp: expected
				children: createElement(StatefulContent),
			}),
		);

		fireEvent.click(screen.getByRole("button", { name: "Increment" }));
		expect(screen.getByText("Count: 1")).toBeTruthy();

		act(() => useFloatingPanelStore.getState().setPanelSlot("test-panel", "content", dockedSlot));

		expect(screen.getByText("Count: 1")).toBeTruthy();
		expect(dockedSlot.contains(screen.getByRole("button", { name: "Increment" }))).toBe(true);

		view.unmount();
		floatingSlot.remove();
		dockedSlot.remove();
	});

	it("restores scroll positions when the panel is reopened in a new slot", () => {
		const firstSlot = document.createElement("div");
		const secondSlot = document.createElement("div");
		document.body.append(firstSlot, secondSlot);
		useFloatingPanelStore.getState().setPanelSlot("test-panel", "content", firstSlot);

		const view = render(
			createElement(FloatingPanel, {
				id: "test-panel",
				title: "Test panel",
				// biome-ignore lint/correctness/noChildrenProp: expected
				children: createElement("div", { "data-testid": "scrollable" }),
			}),
		);

		const scrollable = screen.getByTestId("scrollable");
		scrollable.scrollTop = 120;
		fireEvent.scroll(scrollable);

		act(() => useFloatingPanelStore.getState().setPanelSlot("test-panel", "content", null));
		scrollable.scrollTop = 0;
		act(() => useFloatingPanelStore.getState().setPanelSlot("test-panel", "content", secondSlot));

		expect(scrollable.scrollTop).toBe(120);

		view.unmount();
		firstSlot.remove();
		secondSlot.remove();
	});
});

const StatefulContent = () => {
	const [count, setCount] = useState(0);

	return createElement(
		"div",
		null,
		createElement("span", null, `Count: ${count}`),
		createElement("button", { onClick: () => setCount((value) => value + 1), type: "button" }, "Increment"),
	);
};
