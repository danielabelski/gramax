import { act, renderHook } from "@testing-library/react";
import { RESIZE_CLAMP_DEBOUNCE_MS } from "../constants";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import { useClampFloatingPanelsOnResize } from "./useClampFloatingPanelsOnResize";

describe("useClampFloatingPanelsOnResize", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		localStorage.clear();
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
		useFloatingPanelStore.getState().registerPanel({ id: "panel", title: "Panel" });
		useFloatingPanelStore.getState().setIsOpen("panel", true);
		useFloatingPanelStore.getState().setPosition("panel", { x: 900, y: 700 });
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("clamps panels when the window is resized", () => {
		renderHook(() => useClampFloatingPanelsOnResize());

		act(() => window.dispatchEvent(new Event("resize")));
		act(() => jest.advanceTimersByTime(RESIZE_CLAMP_DEBOUNCE_MS));

		expect(useFloatingPanelStore.getState().panels.panel.position).toEqual({ x: 480, y: 120 });
	});

	it("clamps once for a burst of resize events", () => {
		const clampPositions = jest.spyOn(useFloatingPanelStore.getState(), "clampPositions");
		renderHook(() => useClampFloatingPanelsOnResize());

		act(() => {
			window.dispatchEvent(new Event("resize"));
			jest.advanceTimersByTime(RESIZE_CLAMP_DEBOUNCE_MS - 1);
			window.dispatchEvent(new Event("resize"));
			jest.advanceTimersByTime(RESIZE_CLAMP_DEBOUNCE_MS);
		});

		expect(clampPositions).toHaveBeenCalledTimes(1);
	});

	it("removes the resize listener when unmounted", () => {
		const { unmount } = renderHook(() => useClampFloatingPanelsOnResize());
		unmount();

		act(() => window.dispatchEvent(new Event("resize")));
		act(() => jest.advanceTimersByTime(RESIZE_CLAMP_DEBOUNCE_MS));

		expect(useFloatingPanelStore.getState().panels.panel.position).toEqual({ x: 900, y: 700 });
	});

	it("does not clamp when unmounted before the debounce fires", () => {
		const { unmount } = renderHook(() => useClampFloatingPanelsOnResize());

		act(() => window.dispatchEvent(new Event("resize")));
		unmount();
		act(() => jest.advanceTimersByTime(RESIZE_CLAMP_DEBOUNCE_MS));

		expect(useFloatingPanelStore.getState().panels.panel.position).toEqual({ x: 900, y: 700 });
	});
});
