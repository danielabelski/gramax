import { useSidebarsPinStore } from "@core-ui/ContextServices/Sidebars/SidebarsPinStore";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import WidthWrapper from "./WidthWrapper";

jest.mock("@core-ui/hooks/useShowMainLangContentPreview", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => false,
}));
jest.mock("@ext/git/core/Diff/components/store/DiffViewModeStore", () => ({ useIsDoublePanel: () => false }));
jest.mock("@ext/git/core/Diff/logic/hooks/useIsDiffView", () => ({ useIsDiffView: () => false }));
jest.mock("@ext/markdown/elements/table/edit/components/Helpers/consts", () => ({ VERTICAL_TOP_OFFSET: "0px" }));
jest.mock("@ext/markdown/elements/table/render/components/TableWrapper", () => ({
	CELL_MIN_WIDTH: "40px",
	PADDING_TOP_BOTTOM: "0px",
}));

class ResizeObserverMock {
	static instances: ResizeObserverMock[] = [];
	targets = new Set<Element>();
	constructor(private _callback: ResizeObserverCallback) {
		ResizeObserverMock.instances.push(this);
	}
	observe(target: Element) {
		this.targets.add(target);
	}
	unobserve(target: Element) {
		this.targets.delete(target);
	}
	disconnect() {
		this.targets.clear();
	}
	resize(target: Element) {
		if (this.targets.has(target)) {
			this._callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
		}
	}
}

describe("WidthWrapper measurements", () => {
	const originalResizeObserver = global.ResizeObserver;
	let frames: Map<number, FrameRequestCallback>;
	let frameId: number;

	beforeEach(() => {
		frames = new Map();
		frameId = 0;
		ResizeObserverMock.instances = [];
		global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
		jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			frames.set(++frameId, callback);
			return frameId;
		});
		jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => frames.delete(id));
		useSidebarsPinStore.setState({ isLeftPinned: true });
	});

	afterEach(() => {
		cleanup();
		jest.restoreAllMocks();
		global.ResizeObserver = originalResizeObserver;
	});

	const flushFrame = () => {
		act(() => {
			const callbacks = [...frames.values()];
			frames.clear();
			callbacks.forEach((callback) => callback(0));
		});
	};

	const mount = () => {
		const view = render(createElement(WidthWrapper, null, createElement("div", null, "wide content")));
		const scroll = view.container.querySelector<HTMLElement>(".scrollableContent");
		const child = scroll.firstElementChild;
		const height = jest.spyOn(scroll, "clientHeight", "get").mockReturnValue(120);
		const rect = jest.spyOn(scroll, "getBoundingClientRect").mockReturnValue({ left: 100, right: 500 } as DOMRect);
		jest.spyOn(child, "getBoundingClientRect").mockReturnValue({ left: 80, right: 580 } as DOMRect);
		const resize = (target: Element) => act(() => ResizeObserverMock.instances.forEach((o) => o.resize(target)));
		return { ...view, scroll, child, height, rect, resize };
	};

	it("does not read geometry just because navigation pin state changes", () => {
		const { height, rect } = mount();
		flushFrame();
		height.mockClear();
		rect.mockClear();
		act(() => useSidebarsPinStore.setState({ isLeftPinned: false }));
		flushFrame();
		expect(height).not.toHaveBeenCalled();
		expect(rect).not.toHaveBeenCalled();
	});

	it("updates overflow shadows when the viewport resizes without resizing its child", () => {
		const { container, scroll, rect, resize } = mount();
		flushFrame();
		resize(scroll);
		flushFrame();
		expect(container.querySelector<HTMLElement>(".shadow-box.right")?.style.width).toBe("40px");
		expect(container.querySelector<HTMLElement>(".shadow-box.right")?.style.height).toBe("120px");
		rect.mockReturnValue({ left: 100, right: 600 } as DOMRect);
		resize(scroll);
		flushFrame();
		expect(container.querySelector(".shadow-box.right")).toBeNull();
	});

	it("batches child resize, viewport resize and scroll measurements into one frame", () => {
		const { scroll, child, height, resize } = mount();
		flushFrame();
		height.mockClear();
		resize(child);
		resize(scroll);
		fireEvent.scroll(scroll);
		fireEvent.resize(window);
		expect(height).not.toHaveBeenCalled();
		flushFrame();
		expect(height).toHaveBeenCalledTimes(1);
	});

	it("cancels pending measurements on unmount", () => {
		const { unmount, child, height, resize } = mount();
		flushFrame();
		height.mockClear();
		resize(child);
		unmount();
		flushFrame();
		expect(height).not.toHaveBeenCalled();
		expect(frames.size).toBe(0);
	});
});
