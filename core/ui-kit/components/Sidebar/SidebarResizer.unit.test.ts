import { fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { SidebarResizer } from "./SidebarResizer";

const renderResizer = (onPointerEnter: () => void, onPointerLeave: () => void) =>
	render(
		createElement(SidebarResizer, {
			maxWidth: 500,
			minWidth: 200,
			onPointerEnter,
			onPointerLeave,
			onResize: () => {},
			onResizeStop: () => {},
			width: 300,
		}),
	);

test("keeps sidebar hover active while the pointer is over the resize handle", () => {
	const onPointerEnter = jest.fn();
	const onPointerLeave = jest.fn();
	const { container } = renderResizer(onPointerEnter, onPointerLeave);
	const handle = container.querySelector<HTMLElement>(".group");

	expect(handle).not.toBeNull();
	fireEvent.pointerEnter(handle!);
	fireEvent.pointerLeave(handle!);

	expect(onPointerEnter).toHaveBeenCalledTimes(1);
	expect(onPointerLeave).toHaveBeenCalledTimes(1);
});

test("prevents text selection when resizing starts", () => {
	const { container } = renderResizer(
		() => {},
		() => {},
	);
	const handle = container.querySelector<HTMLElement>(".group");

	expect(handle).not.toBeNull();
	expect(fireEvent.mouseDown(handle!)).toBe(false);
	fireEvent.mouseUp(window);
});

test("keeps resize measurements out of the shared article container", () => {
	const onResize = jest.fn();
	const onResizeStop = jest.fn();
	const { container, getByTestId } = render(
		createElement(
			"div",
			{ "data-testid": "catalog", style: { display: "flex" } },
			createElement("article", null, "Article content"),
			createElement(SidebarResizer, {
				width: 300,
				minWidth: 200,
				maxWidth: 500,
				onResize,
				onResizeStop,
			}),
		),
	);
	const handle = container.querySelector<HTMLElement>(".group")!;
	const resizer = handle.closest<HTMLElement>("[style*='position: fixed']")!;
	Object.defineProperty(resizer, "offsetWidth", { get: () => Number.parseFloat(resizer.style.width) });
	const observer = new MutationObserver(() => {});
	try {
		fireEvent.mouseDown(handle, { clientX: 300 });
		observer.observe(getByTestId("catalog"), { attributes: true, childList: true });
		fireEvent.mouseMove(window, { clientX: 340 });
		fireEvent.mouseUp(window);

		expect(onResize).toHaveBeenLastCalledWith(340);
		expect(onResizeStop).toHaveBeenCalledWith(340);
		expect(observer.takeRecords().length).toBe(0);
	} finally {
		observer.disconnect();
		fireEvent.mouseUp(window);
	}
});
