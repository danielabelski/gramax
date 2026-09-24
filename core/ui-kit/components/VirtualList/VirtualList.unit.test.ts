import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement, useCallback, useRef } from "react";
import { VirtualList } from ".";

const items = Array.from({ length: 10000 }, (_, id) => ({ id: String(id) }));
const getItemKey = (item: { id: string }) => item.id;
const estimateSize = () => 30;

describe("VirtualList", () => {
	let scrollElement: HTMLDivElement;

	beforeEach(() => {
		jest.useFakeTimers();
		scrollElement = document.createElement("div");
		Object.defineProperties(scrollElement, {
			offsetHeight: { value: 300 },
			clientHeight: { value: 300 },
			scrollHeight: { value: 300000 },
		});
		scrollElement.scrollTo = (options: ScrollToOptions | number, y?: number) => {
			scrollElement.scrollTop = typeof options === "number" ? y : options.top;
			scrollElement.dispatchEvent(new Event("scroll"));
		};
		document.body.append(scrollElement);
	});

	afterEach(() => {
		scrollElement.remove();
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	const list = (scrollToKey?: string, pinnedKeys?: string[], scrollToAlign?: "auto" | "center") =>
		createElement(VirtualList<{ id: string }>, {
			items,
			getItemKey,
			estimateSize,
			getScrollElement: () => scrollElement,
			scrollToKey,
			scrollToAlign,
			pinnedKeys,
			// biome-ignore lint/correctness/noChildrenProp: createElement render callback
			children: (item) => createElement("button", { type: "button" }, `Row ${item.id}`),
		});

	it("renders a bounded window and replaces it when scrolling", () => {
		render(list(), { container: scrollElement });
		expect(screen.getByText("Row 0")).toBeTruthy();
		expect(screen.getAllByRole("button").length).toBeLessThan(50);

		act(() => {
			scrollElement.scrollTop = 150000;
			fireEvent.scroll(scrollElement);
			jest.advanceTimersByTime(20);
		});
		expect(screen.getByText("Row 5000")).toBeTruthy();
		expect(screen.queryByText("Row 0")).toBeNull();
		expect(screen.getAllByRole("button").length).toBeLessThan(50);
	});

	it("reveals an offscreen selected row without scrolling back on its remount", () => {
		render(list("9000"), { container: scrollElement });
		act(() => jest.advanceTimersByTime(40));
		expect(screen.getByText("Row 9000")).toBeTruthy();

		act(() => {
			scrollElement.scrollTop = 0;
			fireEvent.scroll(scrollElement);
			jest.advanceTimersByTime(40);
		});
		expect(scrollElement.scrollTop).toBe(0);
		expect(screen.getByText("Row 0")).toBeTruthy();
	});

	it("centers an offscreen selected row", () => {
		render(list("9000", undefined, "center"), { container: scrollElement });
		act(() => jest.advanceTimersByTime(40));
		expect(scrollElement.scrollTop).toBe(269865);
	});

	it("leaves an already visible selected row where it is", () => {
		render(list("2", undefined, "center"), { container: scrollElement });
		act(() => jest.advanceTimersByTime(40));
		expect(scrollElement.scrollTop).toBe(0);
	});

	it("keeps the drag source and interacted row mounted outside the window", () => {
		render(list(undefined, ["3"]), { container: scrollElement });
		fireEvent.pointerDown(screen.getByText("Row 5"));
		act(() => {
			scrollElement.scrollTop = 150000;
			fireEvent.scroll(scrollElement);
			jest.advanceTimersByTime(20);
		});
		expect(screen.getByText("Row 3")).toBeTruthy();
		expect(screen.getByText("Row 5")).toBeTruthy();
		expect(screen.getAllByRole("button").length).toBeLessThan(50);
	});

	it("measures content above the list when the scroll owner ref is attached after its children", () => {
		jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
			return { top: this.classList.contains("relative") ? 150 - scrollElement.scrollTop : 0 } as DOMRect;
		});
		const Navigation = () => {
			const container = useRef<HTMLDivElement>(null);
			const getScrollElement = useCallback(() => container.current?.parentElement ?? null, []);
			return createElement(
				"div",
				{ ref: container },
				createElement(VirtualList<{ id: string }>, {
					...list("9000").props,
					getScrollElement,
				}),
			);
		};
		render(createElement(Navigation), { container: scrollElement });
		act(() => jest.advanceTimersByTime(40));
		expect(scrollElement.scrollTop).toBe(269880);
	});

	const disclosure = (expanded: boolean, animateChanges = true, count = 3) =>
		createElement(VirtualList<{ id: string }>, {
			...list().props,
			items: expanded ? items.slice(0, count + 2) : [items[0], items[count + 1]],
			animateChanges,
		});

	it("slides a branch closed before removing its rows, then opens it by height without fading", () => {
		const { rerender, container } = render(disclosure(true), { container: scrollElement });
		const height = () => Number.parseFloat((container.firstChild as HTMLElement).style.height);
		const child = screen.getByText("Row 1");
		rerender(disclosure(false));
		expect(screen.getByText("Row 1")).toBe(child);
		expect(height()).toBe(150);
		act(() => jest.advanceTimersByTime(32));
		expect(height()).toBeGreaterThan(60);
		expect(height()).toBeLessThan(150);
		act(() => jest.advanceTimersByTime(240));
		expect(screen.queryByText("Row 1")).toBeNull();
		expect(height()).toBe(60);

		rerender(disclosure(true));
		expect(height()).toBe(60);
		act(() => jest.advanceTimersByTime(32));
		expect(height()).toBeGreaterThan(60);
		expect(height()).toBeLessThan(150);
		const openingChild = screen.getByText("Row 1");
		expect(openingChild.parentElement.style.opacity).toBe("");
		act(() => jest.advanceTimersByTime(240));
		expect(height()).toBe(150);
		expect(screen.getByText("Row 1")).toBe(openingChild);
	});

	it("reverses from the current height and preserves row DOM and focus when unpacking the branch", () => {
		const { rerender, container } = render(disclosure(false), { container: scrollElement });
		const height = () => Number.parseFloat((container.firstChild as HTMLElement).style.height);
		rerender(disclosure(true));
		act(() => jest.advanceTimersByTime(32));
		const partialHeight = height();
		const child = screen.getByText("Row 1");
		rerender(disclosure(true));
		expect(height()).toBeCloseTo(partialHeight);
		rerender(disclosure(false));
		expect(height()).toBeCloseTo(partialHeight);
		expect(screen.getByText("Row 1")).toBe(child);
		rerender(disclosure(true));
		act(() => child.focus());
		act(() => jest.advanceTimersByTime(240));
		expect(screen.getByText("Row 1")).toBe(child);
		expect(document.activeElement).toBe(child);
	});

	it("keeps a large expanding and collapsing branch bounded at every frame", () => {
		const { rerender } = render(disclosure(false, true, 9998), { container: scrollElement });
		for (const expanded of [true, false]) {
			rerender(disclosure(expanded, true, 9998));
			for (let frame = 0; frame < 16; frame++) {
				act(() => jest.advanceTimersByTime(16));
				expect(screen.getAllByRole("button").length).toBeLessThan(50);
			}
		}
	});

	it("finishes immediately when animation is disabled and respects reduced motion", () => {
		const { rerender, container } = render(disclosure(false), { container: scrollElement });
		rerender(disclosure(true));
		act(() => jest.advanceTimersByTime(32));
		rerender(disclosure(true, false));
		expect((container.firstChild as HTMLElement).style.height).toBe("150px");
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		jest.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: true });
		rerender(disclosure(false));
		expect(screen.queryByText("Row 1")).toBeNull();
		expect((container.firstChild as HTMLElement).style.height).toBe("60px");
	});

	it("reveals a distant selected child when navigation interrupts an opening branch", () => {
		const { rerender } = render(disclosure(false, true, 9998), { container: scrollElement });
		rerender(disclosure(true, true, 9998));
		act(() => jest.advanceTimersByTime(32));
		rerender(
			createElement(VirtualList<{ id: string }>, {
				...disclosure(true, true, 9998).props,
				scrollToKey: "9000",
			}),
		);
		act(() => jest.advanceTimersByTime(40));
		expect(screen.getByText("Row 9000")).toBeTruthy();
		expect(screen.getAllByRole("button").length).toBeLessThan(50);
	});
});
