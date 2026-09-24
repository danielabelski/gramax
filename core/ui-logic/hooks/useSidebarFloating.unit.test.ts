import { act, fireEvent, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import useSidebarFloating from "./useSidebarFloating";

describe("useSidebarFloating", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.replaceChildren();
	});

	it("closes the floating sidebar after the pointer leaves the browser window", () => {
		const sidebar = document.createElement("div");
		document.body.append(sidebar);
		const ref = { current: sidebar } as RefObject<HTMLDivElement>;
		const { result } = renderHook(() => useSidebarFloating(ref, true));

		fireEvent.mouseOver(sidebar);
		expect(result.current.isHoverActive).toBe(true);

		fireEvent.mouseOut(sidebar, { relatedTarget: null });
		act(() => jest.advanceTimersByTime(299));
		expect(result.current.isHoverActive).toBe(true);

		act(() => jest.advanceTimersByTime(1));
		expect(result.current.isHoverActive).toBe(false);
	});
});
