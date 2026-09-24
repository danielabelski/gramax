import {
	createScrollAnimation,
	FOCUS_SCROLL_PADDING,
	scrollTargetFor,
	scrollToElement,
} from "@ext/serach/components/utils/scrollToElement";

const VIEWPORT = 100;
const CONTENT = 400;
const MAX_SCROLL = CONTENT - VIEWPORT;
const ROW = 20;

const stubRect = (element: HTMLElement, top: number, bottom: number) => {
	element.getBoundingClientRect = () => ({ top, bottom, height: bottom - top }) as DOMRect;
};

const stubScroll = (element: HTMLElement, scrollTop: number, scrollHeight: number, clientHeight: number) => {
	let current = scrollTop;
	const max = Math.max(scrollHeight - clientHeight, 0);

	Object.defineProperty(element, "scrollTop", {
		get: () => current,
		set: (value: number) => {
			current = Math.min(Math.max(value, 0), max);
		},
	});
	Object.defineProperty(element, "scrollHeight", { value: scrollHeight });
	Object.defineProperty(element, "clientHeight", { value: clientHeight });
};

interface SceneArgs {
	scrollTop: number;
	rowTop: number;
	rowHeight?: number;
	contentHeight?: number;
}

/** A container occupying viewport rows 0..100, holding one row placed at `rowTop`. */
const scene = (args: SceneArgs) => {
	const container = document.createElement("div");
	const row = document.createElement("div");
	container.appendChild(row);
	document.body.appendChild(container);

	stubRect(container, 0, VIEWPORT);
	stubRect(row, args.rowTop, args.rowTop + (args.rowHeight ?? ROW));
	stubScroll(container, args.scrollTop, args.contentHeight ?? CONTENT, VIEWPORT);

	return { container, row };
};

const scroller = (scrollTop: number, maxScrollTop: number) => {
	const container = document.createElement("div");
	stubScroll(container, scrollTop, maxScrollTop + VIEWPORT, VIEWPORT);
	return container;
};

afterEach(() => {
	document.body.innerHTML = "";
});

describe("scrollTargetFor", () => {
	it("leaves a row that sits clear of both edges alone", () => {
		const { container, row } = scene({ scrollTop: 50, rowTop: 40 });

		expect(scrollTargetFor(container, row)).toBeUndefined();
	});

	it("scrolls down past a row hanging below the container", () => {
		const { container, row } = scene({ scrollTop: 50, rowTop: 95 });

		expect(scrollTargetFor(container, row)).toBe(50 + 15 + FOCUS_SCROLL_PADDING);
	});

	it("scrolls up past a row cut off above the container", () => {
		const { container, row } = scene({ scrollTop: 50, rowTop: -5 });

		expect(scrollTargetFor(container, row)).toBe(50 - 5 - FOCUS_SCROLL_PADDING);
	});

	it("clears a row that is whole but parked under the bottom shadow", () => {
		const { container, row } = scene({ scrollTop: 50, rowTop: VIEWPORT - ROW - 2 });

		expect(scrollTargetFor(container, row)).toBe(50 + FOCUS_SCROLL_PADDING - 2);
	});

	it("clears a row that is whole but parked under the top shadow", () => {
		const { container, row } = scene({ scrollTop: 50, rowTop: 2 });

		expect(scrollTargetFor(container, row)).toBe(50 - FOCUS_SCROLL_PADDING + 2);
	});

	it("scrolls to the very bottom for the last row", () => {
		const { container, row } = scene({ scrollTop: MAX_SCROLL - 10, rowTop: 95 });

		expect(scrollTargetFor(container, row)).toBe(MAX_SCROLL);
	});

	it("scrolls to the very top for the first row", () => {
		const { container, row } = scene({ scrollTop: 5, rowTop: -2 });

		expect(scrollTargetFor(container, row)).toBe(0);
	});

	it("aligns a row taller than the container to its top", () => {
		const { container, row } = scene({ scrollTop: 100, rowTop: -50, rowHeight: 300 });

		expect(scrollTargetFor(container, row)).toBe(100 - 50 - FOCUS_SCROLL_PADDING);
	});

	it("ignores a row that is not inside the container", () => {
		const { container } = scene({ scrollTop: 50, rowTop: 95 });
		const detached = document.createElement("div");
		stubRect(detached, 0, 0);

		expect(scrollTargetFor(container, detached)).toBeUndefined();
	});

	it("ignores a container that cannot scroll", () => {
		const { container, row } = scene({ scrollTop: 0, rowTop: 95, contentHeight: VIEWPORT });

		expect(scrollTargetFor(container, row)).toBeUndefined();
	});
});

describe("scroll animation", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	const run = (ms: number) => jest.advanceTimersByTime(ms);

	it("carries the container to the target and holds there", () => {
		const container = scroller(0, MAX_SCROLL);
		const animation = createScrollAnimation();

		animation.to(container, 120);
		run(1000);

		expect(container.scrollTop).toBe(120);
		expect(jest.getTimerCount()).toBe(0);
	});

	it("moves in steps rather than jumping", () => {
		const container = scroller(0, MAX_SCROLL);
		const animation = createScrollAnimation();

		animation.to(container, 250);
		run(16);

		expect(container.scrollTop).toBeGreaterThan(0);
		expect(container.scrollTop).toBeLessThan(250);
	});

	it("scrolls back up as readily as down", () => {
		const container = scroller(200, MAX_SCROLL);
		const animation = createScrollAnimation();

		animation.to(container, 40);
		run(1000);

		expect(container.scrollTop).toBe(40);
		expect(jest.getTimerCount()).toBe(0);
	});

	// The container stops at its own end; without noticing that, the loop kept rescheduling
	// itself every frame for as long as the page lived.
	it("gives up on a target the container can never reach", () => {
		const container = scroller(0, 50);
		const animation = createScrollAnimation();

		animation.to(container, 5000);
		run(1000);

		expect(container.scrollTop).toBe(50);
		expect(jest.getTimerCount()).toBe(0);
	});

	it("gives up on a container that cannot scroll at all", () => {
		const container = scroller(0, 0);
		const animation = createScrollAnimation();

		animation.to(container, 300);
		run(1000);

		expect(container.scrollTop).toBe(0);
		expect(jest.getTimerCount()).toBe(0);
	});

	it("stops writing once cancelled", () => {
		const container = scroller(0, MAX_SCROLL);
		const animation = createScrollAnimation();

		animation.to(container, 300);
		run(32);
		const stoppedAt = container.scrollTop;
		animation.cancel();
		run(1000);

		expect(stoppedAt).toBeGreaterThan(0);
		expect(container.scrollTop).toBe(stoppedAt);
		expect(jest.getTimerCount()).toBe(0);
	});

	it("replaces a running scroll with the new target", () => {
		const container = scroller(0, MAX_SCROLL);
		const animation = createScrollAnimation();

		animation.to(container, 300);
		run(32);
		animation.to(container, 60);
		run(1000);

		expect(container.scrollTop).toBe(60);
		expect(jest.getTimerCount()).toBe(0);
	});
});

describe("scrollToElement", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it("brings a row below the fold into view", () => {
		const { container, row } = scene({ scrollTop: 50, rowTop: 95 });

		scrollToElement(container, row, createScrollAnimation());
		jest.advanceTimersByTime(1000);

		expect(container.scrollTop).toBe(50 + 15 + FOCUS_SCROLL_PADDING);
	});

	it("starts nothing for a row already in view", () => {
		const { container, row } = scene({ scrollTop: 50, rowTop: 40 });

		scrollToElement(container, row, createScrollAnimation());

		expect(jest.getTimerCount()).toBe(0);
		expect(container.scrollTop).toBe(50);
	});
});
