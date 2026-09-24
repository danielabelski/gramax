import { fireEvent, render } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { type ComponentProps, createElement } from "react";
import type { PanelDragState } from "../../../hooks/usePanelDrag";
import { useFloatingPanelStore } from "../../../store/useFloatingPanelStore";
import { FloatingPanelView } from "./FloatingPanelView";

const PANEL_ID = "test-panel";

const renderFloatingPanelView = (props: ComponentProps<typeof FloatingPanelView>) =>
	render(createElement(TooltipProvider, null, createElement(FloatingPanelView, props)));

const drag: PanelDragState = {
	attributes: {} as PanelDragState["attributes"],
	listeners: undefined,
	setNodeRef: jest.fn(),
	transform: null,
	isDragging: false,
	dockedDragRect: null,
};

describe("FloatingPanelView", () => {
	beforeEach(() => {
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
		useFloatingPanelStore.getState().registerPanel({ id: PANEL_ID, title: "Test panel" });
		useFloatingPanelStore.getState().setPosition(PANEL_ID, { x: 100, y: 100 });
	});

	it("resizes the panel vertically within the viewport", () => {
		const { container } = renderFloatingPanelView({
			id: PANEL_ID,
			title: "Test panel",
			position: { x: 100, y: 100 },
			zIndex: 10,
			isMaximized: false,
			animationOrigin: "top-left",
			presenceState: "open",
			drag,
			onActivate: jest.fn(),
			onClose: jest.fn(),
			onDock: jest.fn(),
			onMaximize: jest.fn(),
			onRestore: jest.fn(),
			onResetSize: jest.fn(),
		});
		const panel = container.firstElementChild as HTMLElement;
		const bottomHandle = container.querySelector<HTMLElement>(
			"[style*='cursor: row-resize'][style*='bottom: -5px']",
		);
		Object.defineProperties(panel, {
			offsetHeight: { configurable: true, get: () => Number.parseFloat(panel.style.height) },
			offsetWidth: { configurable: true, get: () => Number.parseFloat(panel.style.width) },
		});
		panel.getBoundingClientRect = () =>
			({ left: 100, top: 100, right: 420, bottom: 580, width: 320, height: 480 }) as DOMRect;

		expect(bottomHandle).not.toBeNull();
		fireEvent.mouseDown(bottomHandle!, { clientX: 200, clientY: 580 });
		fireEvent.mouseMove(window, { clientX: 200, clientY: 680 });
		fireEvent.mouseUp(window, { clientX: 200, clientY: 680 });

		expect(useFloatingPanelStore.getState().panels[PANEL_ID].size.height).toBe(580);
	});

	it("prevents text selection when resizing starts", () => {
		const { container } = renderFloatingPanelView({
			id: PANEL_ID,
			title: "Test panel",
			position: { x: 100, y: 100 },
			zIndex: 10,
			isMaximized: false,
			animationOrigin: "top-left",
			presenceState: "open",
			drag,
			onActivate: jest.fn(),
			onClose: jest.fn(),
			onDock: jest.fn(),
			onMaximize: jest.fn(),
			onRestore: jest.fn(),
			onResetSize: jest.fn(),
		});
		const bottomHandle = container.querySelector<HTMLElement>(
			"[style*='cursor: row-resize'][style*='bottom: -5px']",
		);

		expect(bottomHandle).not.toBeNull();
		expect(fireEvent.mouseDown(bottomHandle!)).toBe(false);
	});

	it("keeps the stored height when the panel rests against the bottom edge", () => {
		const { container } = renderFloatingPanelView({
			id: PANEL_ID,
			title: "Test panel",
			position: { x: 100, y: 320 },
			zIndex: 10,
			isMaximized: false,
			animationOrigin: "top-left",
			presenceState: "open",
			drag,
			onActivate: jest.fn(),
			onClose: jest.fn(),
			onDock: jest.fn(),
			onMaximize: jest.fn(),
			onRestore: jest.fn(),
			onResetSize: jest.fn(),
		});

		expect((container.firstElementChild as HTMLElement).style.maxHeight).toBe("480px");
	});
});
