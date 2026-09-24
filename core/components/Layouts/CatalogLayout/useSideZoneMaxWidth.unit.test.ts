import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { useSideZoneMaxWidth } from "./useSideZoneMaxWidth";

class ResizeObserverMock {
	static instances: ResizeObserverMock[] = [];
	target: Element;

	constructor(private readonly _callback: ResizeObserverCallback) {
		ResizeObserverMock.instances.push(this);
	}

	observe(target: Element) {
		this.target = target;
	}

	unobserve(_target: Element) {}

	disconnect() {}

	resize(width: number) {
		this._callback(
			[{ target: this.target, contentRect: { width } } as ResizeObserverEntry],
			this as unknown as ResizeObserver,
		);
	}
}

describe("useSideZoneMaxWidth", () => {
	const originalResizeObserver = global.ResizeObserver;

	beforeAll(() => {
		global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
	});

	afterAll(() => {
		global.ResizeObserver = originalResizeObserver;
	});

	it("tracks the width available after the left navigation", () => {
		const Probe = () => {
			const { maxWidth, resizeBoundaryRef } = useSideZoneMaxWidth();
			return createElement("div", {
				"data-max-width": maxWidth,
				ref: resizeBoundaryRef,
			});
		};
		const { container } = render(createElement(Probe));
		const observer = ResizeObserverMock.instances.at(-1);

		act(() => observer.resize(900));

		expect(container.firstElementChild?.getAttribute("data-max-width")).toBe("900");
	});
});
