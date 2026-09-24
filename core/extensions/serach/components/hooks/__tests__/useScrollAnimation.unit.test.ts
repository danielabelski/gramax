import { useScrollAnimation } from "@ext/serach/components/hooks/useScrollAnimation";
import { renderHook } from "@testing-library/react";

const VIEWPORT = 100;

const scroller = (maxScrollTop: number) => {
	const container = document.createElement("div");
	let current = 0;

	Object.defineProperty(container, "scrollTop", {
		get: () => current,
		set: (value: number) => {
			current = Math.min(Math.max(value, 0), maxScrollTop);
		},
	});
	Object.defineProperty(container, "scrollHeight", { value: maxScrollTop + VIEWPORT });
	Object.defineProperty(container, "clientHeight", { value: VIEWPORT });

	return container;
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useScrollAnimation", () => {
	it("keeps the same animation across renders", () => {
		const { result, rerender } = renderHook(() => useScrollAnimation());
		const first = result.current;

		rerender();

		expect(result.current).toBe(first);
	});

	// A scroll left running past the dialog kept writing scrollTop every frame.
	it("cancels a scroll still in flight when the caller unmounts", () => {
		const container = scroller(300);
		const { result, unmount } = renderHook(() => useScrollAnimation());

		result.current.to(container, 300);
		jest.advanceTimersByTime(32);
		const stoppedAt = container.scrollTop;
		unmount();
		jest.advanceTimersByTime(1000);

		expect(stoppedAt).toBeGreaterThan(0);
		expect(container.scrollTop).toBe(stoppedAt);
		expect(jest.getTimerCount()).toBe(0);
	});
});
