import ScrollableElement from "@components/Layouts/ScrollableElement";
import { act, render } from "@testing-library/react";
import { type ComponentProps, createElement } from "react";

jest.mock("@core-ui/hooks/useDragScrolling", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest requires this ESM marker.
	__esModule: true,
	default: jest.fn(),
}));

jest.mock("@core-ui/hooks/useMediaQuery", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest requires this ESM marker.
	__esModule: true,
	default: () => false,
}));

const OriginalResizeObserver = global.ResizeObserver;
const OriginalMutationObserver = global.MutationObserver;

describe("ScrollableElement", () => {
	afterEach(() => {
		global.ResizeObserver = OriginalResizeObserver;
		global.MutationObserver = OriginalMutationObserver;
		jest.restoreAllMocks();
	});

	test("defers and coalesces layout measurements", () => {
		let resize: ResizeObserverCallback;
		const frames: FrameRequestCallback[] = [];
		const observed: Element[] = [];
		const hasScroll = jest.fn();
		const getBoundingClientRect = jest
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockReturnValue({ width: 320 } as DOMRect);
		const scrollHeight = jest.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(200);
		const clientHeight = jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
		const scrollTop = jest.spyOn(HTMLElement.prototype, "scrollTop", "get").mockReturnValue(0);

		global.ResizeObserver = class {
			constructor(callback: ResizeObserverCallback) {
				resize = callback;
			}

			observe(element: Element) {
				observed.push(element);
			}
			disconnect() {}
			unobserve() {}
		} as unknown as typeof ResizeObserver;

		jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			frames.push(callback);
			return frames.length;
		});
		jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

		const child = createElement("div");
		const props: ComponentProps<typeof ScrollableElement> = { children: child, hasScroll };
		const view = render(createElement(ScrollableElement, props));

		expect(hasScroll).not.toHaveBeenCalled();
		expect(getBoundingClientRect).not.toHaveBeenCalled();
		expect(scrollHeight).not.toHaveBeenCalled();
		expect(clientHeight).not.toHaveBeenCalled();
		expect(scrollTop).not.toHaveBeenCalled();
		const scrollContainer = view.container.firstElementChild;
		expect(observed).toEqual([scrollContainer, scrollContainer?.firstElementChild?.firstElementChild]);

		act(() => {
			resize([], {} as ResizeObserver);
			resize([], {} as ResizeObserver);
		});

		expect(frames).toHaveLength(1);
		expect(hasScroll).not.toHaveBeenCalled();

		act(() => frames[0](0));

		expect(hasScroll).toHaveBeenCalledTimes(1);
		expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
		expect(scrollHeight).toHaveBeenCalledTimes(1);
		expect(clientHeight).toHaveBeenCalledTimes(1);
		expect(scrollTop).toHaveBeenCalledTimes(1);
	});

	test("rebinds the resize observer when content replaces its root element", () => {
		let mutation: MutationCallback | undefined;
		const observed: Element[] = [];
		const unobserved: Element[] = [];

		global.ResizeObserver = class {
			observe(element: Element) {
				observed.push(element);
			}
			disconnect() {}
			unobserve(element: Element) {
				unobserved.push(element);
			}
		} as unknown as typeof ResizeObserver;

		global.MutationObserver = class {
			constructor(callback: MutationCallback) {
				mutation = callback;
			}

			observe() {}
			disconnect() {}
			takeRecords() {
				return [];
			}
		} as unknown as typeof MutationObserver;

		jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

		const props: ComponentProps<typeof ScrollableElement> = {
			children: createElement("div"),
		};
		const view = render(createElement(ScrollableElement, props));
		const contentWrapper = view.container.firstElementChild?.firstElementChild;
		const oldContent = contentWrapper?.firstElementChild;
		const newContent = document.createElement("section");

		contentWrapper?.replaceChildren(newContent);

		expect(mutation).toBeDefined();
		act(() => mutation?.([], {} as MutationObserver));

		expect(unobserved).toEqual([oldContent]);
		expect(observed).toContain(newContent);
	});

	test("observes content elements added after the first child", () => {
		let mutation: MutationCallback | undefined;
		const observed: Element[] = [];

		global.ResizeObserver = class {
			observe(element: Element) {
				observed.push(element);
			}
			disconnect() {}
			unobserve() {}
		} as unknown as typeof ResizeObserver;

		global.MutationObserver = class {
			constructor(callback: MutationCallback) {
				mutation = callback;
			}

			observe() {}
			disconnect() {}
			takeRecords() {
				return [];
			}
		} as unknown as typeof MutationObserver;

		const requestFrame = jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
		const props: ComponentProps<typeof ScrollableElement> = {
			children: createElement("div"),
		};
		const view = render(createElement(ScrollableElement, props));
		const contentWrapper = view.container.firstElementChild?.firstElementChild;
		const addedContent = document.createElement("section");

		contentWrapper?.append(addedContent);
		act(() => mutation?.([], {} as MutationObserver));

		expect(observed).toContain(addedContent);
		expect(requestFrame).toHaveBeenCalledTimes(1);
	});
});
