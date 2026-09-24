/** biome-ignore-all lint/style/useNamingConvention: expected */

import {
	ArticleDimensionsContext,
	createArticleDimensions,
} from "@components/Layouts/CatalogLayout/ArticleLayout/useArticleDimensions";
import { ArticleComponentResizer } from "@ext/article/Components/ArticleComponentResizer";
import { act, render } from "@testing-library/react";
import { createElement } from "react";

jest.mock("@core-ui/ContextServices/ArticleRef", () => ({
	__esModule: true,
	default: { value: { current: null } },
}));
jest.mock("@core-ui/ContextServices/PageDataContext", () => ({
	__esModule: true,
	default: { value: { conf: { isReadOnly: true } } },
}));
jest.mock("@core-ui/ContextServices/Sidebars/SidebarsPinStore", () => ({
	useSidebarsPinStore: (selector: (state: { isLeftPinned: boolean }) => boolean) => selector({ isLeftPinned: false }),
}));
jest.mock("@core-ui/hooks/useTouchHandler", () => ({ useTouchHandler: () => ({}) }));

const resizeEntry = (target: Element, width: number): ResizeObserverEntry => ({
	target,
	contentRect: { x: 0, y: 0, width, height: 0, top: 0, left: 0, right: width, bottom: 0, toJSON: () => ({ width }) },
	borderBoxSize: [{ inlineSize: width, blockSize: 0 }],
	contentBoxSize: [{ inlineSize: width, blockSize: 0 }],
	devicePixelContentBoxSize: [{ inlineSize: width, blockSize: 0 }],
});

describe("ArticleComponentResizer", () => {
	const originalResizeObserver = global.ResizeObserver;
	afterEach(() => {
		global.ResizeObserver = originalResizeObserver;
		jest.restoreAllMocks();
	});
	test.each([
		{ scale: 150, expected: "400px" },
		{ scale: "900px", expected: "400px" },
		{ scale: 50, expected: "200px" },
	])("keeps nested media inside its own column for scale $scale", ({ scale, expected }) => {
		let resize: ResizeObserverCallback;
		let target: Element;
		global.ResizeObserver = class {
			constructor(callback: ResizeObserverCallback) {
				resize = callback;
			}
			observe = (element: Element) => {
				target = element;
			};
			unobserve = jest.fn();
			disconnect = jest.fn();
		} as unknown as typeof ResizeObserver;
		const dimensions = createArticleDimensions();
		dimensions.setWidth(1000);
		const { container } = render(
			createElement(
				ArticleDimensionsContext.Provider,
				{ value: dimensions },
				createElement(
					"section",
					{ "data-component": "note" },
					createElement(
						"div",
						{ "data-component": "image" },
						createElement(ArticleComponentResizer, { scale, id: "nested" }),
					),
				),
			),
		);
		act(() => resize([resizeEntry(target, 400)], {} as ResizeObserver));
		const media = container.querySelector<HTMLElement>("#nested");
		expect(media.style.width).toBe(expected);
		expect(media.parentElement.style.marginLeft).toBe("");
	});

	test("reuses cached measurements and releases the observer after the last consumer leaves", () => {
		let resize: ResizeObserverCallback;
		const observe = jest.fn();
		const unobserve = jest.fn();
		const disconnect = jest.fn();
		global.ResizeObserver = class {
			constructor(callback: ResizeObserverCallback) {
				resize = callback;
			}
			observe = observe;
			unobserve = unobserve;
			disconnect = disconnect;
		} as unknown as typeof ResizeObserver;
		const dimensions = createArticleDimensions();
		const target = document.createElement("div");
		const first = jest.fn();
		const second = jest.fn();
		const stopFirst = dimensions.observe(target, first);
		resize([resizeEntry(target, 600)], {} as ResizeObserver);
		const stopSecond = dimensions.observe(target, second);
		expect(second).toHaveBeenCalledWith(600);
		expect(observe).toHaveBeenCalledTimes(1);
		resize([resizeEntry(target, 600)], {} as ResizeObserver);
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		stopFirst();
		expect(unobserve).not.toHaveBeenCalled();
		expect(disconnect).not.toHaveBeenCalled();
		stopSecond();
		expect(unobserve).toHaveBeenCalledWith(target);
		expect(disconnect).toHaveBeenCalledTimes(1);
	});
	test("shares measurements and updates scales during an article resize without reading computed styles", () => {
		let resize: ResizeObserverCallback;
		const observe = jest.fn();
		global.ResizeObserver = class {
			constructor(callback: ResizeObserverCallback) {
				resize = callback;
			}
			observe = observe;
			unobserve = jest.fn();
			disconnect = jest.fn();
		} as unknown as typeof ResizeObserver;
		const dimensions = createArticleDimensions();
		const computedStyle = jest.spyOn(window, "getComputedStyle");
		const { container } = render(
			createElement(
				ArticleDimensionsContext.Provider,
				{ value: dimensions },
				createElement(
					"section",
					null,
					createElement(
						"div",
						{ "data-resize-container": true },
						createElement(ArticleComponentResizer, { scale: 50, id: "half" }),
					),
					createElement(
						"div",
						{ "data-resize-container": true },
						createElement(ArticleComponentResizer, { scale: 150, id: "wide" }),
					),
				),
			),
		);
		const section = container.querySelector("section");
		expect(observe.mock.calls.filter(([target]) => target === section)).toHaveLength(1);
		act(() => {
			dimensions.setWidth(900);
			resize([resizeEntry(section, 600)], {} as ResizeObserver);
		});
		expect(container.querySelector<HTMLElement>("#half").style.width).toBe("300px");
		expect(container.querySelector<HTMLElement>("#wide").style.width).toBe("750px");
		act(() => {
			dimensions.setWidth(700);
			resize([resizeEntry(section, 500)], {} as ResizeObserver);
		});
		expect(container.querySelector<HTMLElement>("#half").style.width).toBe("250px");
		expect(container.querySelector<HTMLElement>("#wide").style.width).toBe("600px");
		expect(computedStyle).not.toHaveBeenCalled();
		computedStyle.mockRestore();
	});
	test("retries scale when the container width is initially unavailable", () => {
		let resize: ResizeObserverCallback;
		let target: Element;
		global.ResizeObserver = class {
			constructor(callback: ResizeObserverCallback) {
				resize = callback;
			}
			observe = (element: Element) => {
				target = element;
			};
			disconnect = jest.fn();
			unobserve = jest.fn();
		} as unknown as typeof ResizeObserver;

		const { container } = render(createElement(ArticleComponentResizer, { scale: 50 }, createElement("div")));
		const resizable = container.firstElementChild?.firstElementChild as HTMLElement;
		act(() => resize([resizeEntry(target, 0)], {} as ResizeObserver));
		expect(resizable.style.width).toBe("");
		act(() => resize([resizeEntry(target, 200)], {} as ResizeObserver));
		expect(resizable.style.width).toBe("100px");
		act(() => resize([resizeEntry(target, 300)], {} as ResizeObserver));
		expect(resizable.style.width).toBe("150px");
	});
});
