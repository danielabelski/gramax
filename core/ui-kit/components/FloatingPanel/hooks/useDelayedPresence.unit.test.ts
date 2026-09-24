import { act, renderHook } from "@testing-library/react";
import { useDelayedPresence } from "./useDelayedPresence";

describe("useDelayedPresence", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it("keeps content present for the exit duration", () => {
		const { result, rerender } = renderHook(({ isOpen }) => useDelayedPresence(isOpen, 180), {
			initialProps: { isOpen: true },
		});

		rerender({ isOpen: false });
		expect(result.current).toBe(true);

		act(() => jest.advanceTimersByTime(179));
		expect(result.current).toBe(true);

		act(() => jest.advanceTimersByTime(1));
		expect(result.current).toBe(false);
	});

	it("cancels a pending exit when content reopens", () => {
		const { result, rerender } = renderHook(({ isOpen }) => useDelayedPresence(isOpen, 180), {
			initialProps: { isOpen: true },
		});

		rerender({ isOpen: false });
		act(() => jest.advanceTimersByTime(100));
		rerender({ isOpen: true });
		act(() => jest.advanceTimersByTime(100));

		expect(result.current).toBe(true);
	});
});
