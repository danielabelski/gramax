import { act, fireEvent, renderHook } from "@testing-library/react";
import { useFloatingPanelStore } from "@ui-kit/FloatingPanel";
import type { RefObject } from "react";
import { usePanelToggle } from "./usePanelToggle";

const PANEL_ID = "test-panel";

describe("usePanelToggle", () => {
	beforeEach(() => {
		localStorage.clear();
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
		useFloatingPanelStore.getState().registerPanel({ id: PANEL_ID, title: "Test" });
		Object.defineProperties(window, {
			innerWidth: { configurable: true, value: 1000 },
			innerHeight: { configurable: true, value: 800 },
		});
	});

	it("places a panel by its trigger on first open and toggles it", () => {
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.getBoundingClientRect = () => ({ left: 900, right: 930, top: 700, bottom: 730 }) as DOMRect;
		const { result } = renderHook(() =>
			usePanelToggle(PANEL_ID, { current: trigger } as RefObject<HTMLButtonElement>),
		);

		act(() => result.current.open());

		expect(useFloatingPanelStore.getState().panels[PANEL_ID]).toMatchObject({
			isOpen: true,
			position: { x: 610, y: 208 },
			animationOrigin: "bottom-right",
		});

		act(() => result.current.toggle());
		expect(useFloatingPanelStore.getState().panels[PANEL_ID].isOpen).toBe(false);
	});

	it("repositions an untouched panel from its visible trigger on every open", () => {
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.getBoundingClientRect = () => ({ left: 24, right: 88, top: 100, bottom: 140 }) as DOMRect;
		const { result } = renderHook(() =>
			usePanelToggle(PANEL_ID, { current: trigger } as RefObject<HTMLButtonElement>),
		);

		act(() => result.current.open());
		expect(useFloatingPanelStore.getState().panels[PANEL_ID].position).toEqual({ x: 24, y: 152 });

		act(() => result.current.close());
		trigger.getBoundingClientRect = () => ({ left: 100, right: 164, top: 200, bottom: 240 }) as DOMRect;
		act(() => result.current.open());

		expect(useFloatingPanelStore.getState().panels[PANEL_ID].position).toEqual({ x: 100, y: 252 });
	});

	it("keeps an open untouched panel anchored when the viewport changes", () => {
		let frame: FrameRequestCallback | undefined;
		jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			frame = callback;
			return 1;
		});
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.getBoundingClientRect = () => ({ left: 24, right: 88, top: 100, bottom: 140 }) as DOMRect;
		const { result } = renderHook(() =>
			usePanelToggle(PANEL_ID, { current: trigger } as RefObject<HTMLButtonElement>),
		);
		act(() => result.current.open());

		trigger.getBoundingClientRect = () => ({ left: 100, right: 164, top: 200, bottom: 240 }) as DOMRect;
		fireEvent.resize(window);
		act(() => frame?.(0));

		expect(useFloatingPanelStore.getState().panels[PANEL_ID].position).toEqual({ x: 100, y: 252 });
	});

	it("coalesces viewport events into one position update per animation frame", () => {
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.getBoundingClientRect = () => ({ left: 24, right: 88, top: 100, bottom: 140 }) as DOMRect;
		const frames: FrameRequestCallback[] = [];
		jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			frames.push(callback);
			return frames.length;
		});
		const { result } = renderHook(() =>
			usePanelToggle(PANEL_ID, { current: trigger } as RefObject<HTMLButtonElement>),
		);
		act(() => result.current.open());
		trigger.getBoundingClientRect = () => ({ left: 100, right: 164, top: 200, bottom: 240 }) as DOMRect;

		fireEvent.scroll(window);
		fireEvent.scroll(window);
		fireEvent.resize(window);

		expect(frames).toHaveLength(1);
		expect(useFloatingPanelStore.getState().panels[PANEL_ID].position).toEqual({ x: 24, y: 152 });
		act(() => frames[0](0));
		expect(useFloatingPanelStore.getState().panels[PANEL_ID].position).toEqual({ x: 100, y: 252 });
	});

	it("does not anchor a panel to a disconnected trigger", () => {
		const trigger = document.createElement("button");
		trigger.getBoundingClientRect = () => ({ left: 24, right: 88, top: 100, bottom: 140 }) as DOMRect;
		const { result } = renderHook(() =>
			usePanelToggle(PANEL_ID, { current: trigger } as RefObject<HTMLButtonElement>),
		);

		act(() => result.current.open());

		expect(useFloatingPanelStore.getState().panels[PANEL_ID].position).toEqual({ x: 340, y: 160 });
	});

	it("uses a registered trigger when another consumer opens the panel", () => {
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.getBoundingClientRect = () => ({ left: 900, right: 930, top: 700, bottom: 730 }) as DOMRect;
		renderHook(() => usePanelToggle(PANEL_ID, { current: trigger } as RefObject<HTMLButtonElement>));
		const { result } = renderHook(() => usePanelToggle(PANEL_ID));

		act(() => result.current.open());

		expect(useFloatingPanelStore.getState().panels[PANEL_ID].position).toEqual({ x: 610, y: 208 });
	});

	it("centers a panel opened without a trigger", () => {
		const { result } = renderHook(() => usePanelToggle(PANEL_ID));

		act(() => result.current.open());

		expect(useFloatingPanelStore.getState().panels[PANEL_ID].position).toEqual({ x: 340, y: 160 });
	});

	it("places a panel inward from a bottom-edge trigger", () => {
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.getBoundingClientRect = () => ({ left: 100, right: 164, top: 700, bottom: 740 }) as DOMRect;
		const { result } = renderHook(() =>
			usePanelToggle(PANEL_ID, { current: trigger } as RefObject<HTMLButtonElement>),
		);

		act(() => result.current.open());

		expect(useFloatingPanelStore.getState().panels[PANEL_ID].position).toEqual({ x: 100, y: 208 });
	});

	it("opens a registered panel without a trigger", () => {
		const { result } = renderHook(() => usePanelToggle(PANEL_ID));

		act(() => result.current.open());

		expect(useFloatingPanelStore.getState().panels[PANEL_ID].isOpen).toBe(true);
	});
});
