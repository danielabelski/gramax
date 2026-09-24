import { fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { useFloatingPanelStore } from "../../store/useFloatingPanelStore";
import { SideZone } from "./SideZone";

describe("SideZone", () => {
	it("keeps the resize edge flush with the right panel", () => {
		const { container } = render(createElement(SideZone, { isOver: false, panels: [], side: "right" }));
		const panel = container.firstElementChild?.firstElementChild as HTMLElement | undefined;

		expect(panel?.style.marginLeft).toBe("");
		expect(panel?.style.marginRight).toBe("8px");
	});

	it("restores the default right zone width on resize handle double click", () => {
		useFloatingPanelStore.getState().setSideZoneWidth("right", 360);
		const { container } = render(createElement(SideZone, { isOver: false, panels: [], side: "right" }));
		const resizeHandle = container.querySelector<HTMLElement>("[style*='cursor: col-resize']");
		const clickTarget = resizeHandle?.firstElementChild ?? resizeHandle;

		expect(clickTarget).not.toBeNull();
		fireEvent.mouseDown(clickTarget!, { detail: 1 });
		fireEvent.mouseUp(window);
		expect(useFloatingPanelStore.getState().sideZoneWidths.right).toBe(360);

		fireEvent.mouseDown(clickTarget!, { detail: 2 });
		fireEvent.mouseUp(window);

		expect(useFloatingPanelStore.getState().sideZoneWidths.right).toBe(292);
	});

	it("does not reapply the previous resize delta on a click without movement", () => {
		useFloatingPanelStore.getState().setSideZoneWidth("right", 300);
		const { container } = render(createElement(SideZone, { isOver: false, panels: [], side: "right" }));
		const resizable = container.firstElementChild as HTMLElement;
		const resizeHandle = container.querySelector<HTMLElement>("[style*='cursor: col-resize']");
		Object.defineProperties(resizable, {
			offsetHeight: { configurable: true, value: 600 },
			offsetWidth: { configurable: true, get: () => Number.parseFloat(resizable.style.width) },
		});

		expect(resizeHandle).not.toBeNull();
		fireEvent.mouseDown(resizeHandle!, { clientX: 300 });
		fireEvent.mouseMove(window, { clientX: 250 });
		fireEvent.mouseUp(window, { clientX: 250 });
		expect(useFloatingPanelStore.getState().sideZoneWidths.right).toBe(350);

		fireEvent.mouseDown(resizeHandle!, { clientX: 250 });
		fireEvent.mouseUp(window, { clientX: 250 });

		expect(useFloatingPanelStore.getState().sideZoneWidths.right).toBe(350);
	});

	it("does not resize past the available width", () => {
		useFloatingPanelStore.getState().setSideZoneWidth("right", 400);
		const { container } = render(
			createElement(SideZone, {
				isOver: false,
				maxWidth: 900,
				panels: [],
				side: "right",
			}),
		);
		const resizable = container.firstElementChild as HTMLElement;
		const resizeHandle = container.querySelector<HTMLElement>("[style*='cursor: col-resize']");
		Object.defineProperties(resizable, {
			offsetHeight: { configurable: true, value: 600 },
			offsetWidth: { configurable: true, get: () => Number.parseFloat(resizable.style.width) },
		});
		resizable.getBoundingClientRect = () =>
			({ left: 800, right: 1200, top: 0, bottom: 600, width: 400, height: 600 }) as DOMRect;

		expect(resizeHandle).not.toBeNull();
		fireEvent.mouseDown(resizeHandle!, { clientX: 800 });
		fireEvent.mouseMove(window, { clientX: 0 });
		fireEvent.mouseUp(window, { clientX: 0 });

		expect(useFloatingPanelStore.getState().sideZoneWidths.right).toBe(900);
	});

	it("clamps the current width when the available width shrinks", () => {
		useFloatingPanelStore.getState().setSideZoneWidth("right", 1000);

		render(
			createElement(SideZone, {
				isOver: false,
				maxWidth: 900,
				panels: [],
				side: "right",
			}),
		);

		expect(useFloatingPanelStore.getState().sideZoneWidths.right).toBe(900);
	});
});
