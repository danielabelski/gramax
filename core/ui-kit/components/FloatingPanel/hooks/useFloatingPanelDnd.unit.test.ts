import type { DragEndEvent, Modifier } from "@dnd-kit/core";
import { act, renderHook } from "@testing-library/react";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import { useFloatingPanelDnd } from "./useFloatingPanelDnd";

const dragEndEvent = ({
	deltaX = 0,
	deltaY = 0,
	grabPointX = 100,
	grabPointY = 100,
	translatedLeft = 880,
	translatedRight = 1200,
}: {
	deltaX?: number;
	deltaY?: number;
	grabPointX?: number;
	grabPointY?: number;
	translatedLeft?: number;
	translatedRight?: number;
} = {}) =>
	({
		active: {
			id: "panel",
			rect: {
				current: {
					translated: { left: translatedLeft, right: translatedRight, top: 120, bottom: 600 },
				},
			},
		},
		activatorEvent: new MouseEvent("mousedown", { clientX: grabPointX, clientY: grabPointY }),
		delta: { x: deltaX, y: deltaY },
	}) as unknown as DragEndEvent;

const modifierArgs = (transform: { x: number; y: number }) =>
	({
		draggingNodeRect: { bottom: 580, left: 100, right: 420, top: 100 },
		transform: { ...transform, scaleX: 1, scaleY: 1 },
		windowRect: { height: 800, left: 0, top: 0, width: 1200 },
	}) as Parameters<Modifier>[0];

describe("useFloatingPanelDnd", () => {
	beforeEach(() => {
		localStorage.clear();
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
		useFloatingPanelStore.getState().registerPanel({ id: "panel", title: "Panel" });
		useFloatingPanelStore.getState().setPosition("panel", { x: 100, y: 120 });
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
	});

	it("does not dock at the edge when the dock zone is hidden", () => {
		useFloatingPanelStore.getState().setRightDockZoneAvailability(false, { width: 1200, height: 800 });
		const { result } = renderHook(() => useFloatingPanelDnd());

		act(() => result.current.handleDragEnd(dragEndEvent({ deltaX: 20 })));

		expect(useFloatingPanelStore.getState().panels.panel).toMatchObject({
			dockedSide: null,
			position: { x: 120, y: 120 },
		});
	});

	it("stops the whole panel at the left and bottom viewport edges", () => {
		useFloatingPanelStore.getState().setRightDockZoneAvailability(false, { width: 1200, height: 800 });
		const { result } = renderHook(() => useFloatingPanelDnd());

		act(() => result.current.handleDragEnd(dragEndEvent({ deltaX: -500, deltaY: 700 })));

		expect(useFloatingPanelStore.getState().panels.panel.position).toEqual({ x: 0, y: 320 });
	});

	it.each([
		["left", { x: -200, y: 0 }, { x: -100, y: 0 }],
		["top", { x: 0, y: -200 }, { x: 0, y: -100 }],
		["bottom", { x: 0, y: 400 }, { x: 0, y: 220 }],
	])("stops the panel at the %s viewport edge while dragging", (_, transform, expected) => {
		const { result } = renderHook(() => useFloatingPanelDnd());

		expect(result.current.modifiers?.[0]?.(modifierArgs(transform))).toEqual({
			...expected,
			scaleX: 1,
			scaleY: 1,
		});
	});

	it("does not constrain the right edge while dragging", () => {
		const { result } = renderHook(() => useFloatingPanelDnd());

		expect(result.current.modifiers?.[0]?.(modifierArgs({ x: 1000, y: 0 }))).toEqual({
			x: 1000,
			y: 0,
			scaleX: 1,
			scaleY: 1,
		});
	});

	it("does not dock a wide panel when its edge reaches the dock zone before the grab point", () => {
		useFloatingPanelStore.getState().setRightDockZoneAvailability(true, { width: 1200, height: 800 });
		const { result } = renderHook(() => useFloatingPanelDnd());

		act(() =>
			result.current.handleDragEnd(
				dragEndEvent({ deltaX: 600, grabPointX: 520, translatedLeft: 1100, translatedRight: 1580 }),
			),
		);

		expect(useFloatingPanelStore.getState().panels.panel.dockedSide).toBeNull();
	});

	it("docks when the grab point reaches the 64px edge zone", () => {
		useFloatingPanelStore.getState().setRightDockZoneAvailability(true, { width: 1200, height: 800 });
		const { result } = renderHook(() => useFloatingPanelDnd());

		act(() =>
			result.current.handleDragEnd(
				dragEndEvent({ deltaX: 716, grabPointX: 420, translatedLeft: 1116, translatedRight: 1596 }),
			),
		);

		expect(useFloatingPanelStore.getState().panels.panel.dockedSide).toBe("right");
	});

	it("docks within the real bounds when the right dock zone already exists", () => {
		useFloatingPanelStore.getState().setRightDockZoneAvailability(true, { width: 1200, height: 800 });
		useFloatingPanelStore.setState((state) => ({
			...state,
			rightDockZoneBounds: { left: 908, right: 1200, top: 60, bottom: 740 },
		}));
		const { result } = renderHook(() => useFloatingPanelDnd());

		act(() =>
			result.current.handleDragEnd(
				dragEndEvent({ deltaX: 450, grabPointX: 500, grabPointY: 400, translatedLeft: 850 }),
			),
		);

		expect(useFloatingPanelStore.getState().panels.panel.dockedSide).toBe("right");
	});
});
