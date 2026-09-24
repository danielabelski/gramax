import useArticleScrollPosition from "@core-ui/hooks/useArticleScrollPosition";
import { useScrollPositionStore } from "@core-ui/stores/ScrollPositionStore";
import { act, renderHook } from "@testing-library/react";

let mockArticle: HTMLDivElement;

jest.mock("@core-ui/ContextServices/ArticleRef", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest requires this module interop flag.
	__esModule: true,
	default: {
		get value() {
			return { current: mockArticle };
		},
	},
}));

const articleData = (path: string) => ({ articleProps: { ref: { path } } }) as never;

describe("useArticleScrollPosition", () => {
	const frames = new Map<number, FrameRequestCallback>();
	const originalGetEntriesByType = performance.getEntriesByType;
	let nextFrameId = 0;

	const runFrame = (timestamp: number) => {
		const callbacks = [...frames.values()];
		frames.clear();
		callbacks.forEach((callback) => callback(timestamp));
	};

	beforeEach(() => {
		jest.useFakeTimers();
		mockArticle = document.createElement("div");
		mockArticle.append(document.createElement("div"));
		document.body.append(mockArticle);
		useScrollPositionStore.setState({
			isProgrammaticScroll: false,
			isRestoringScrollPosition: false,
			positions: { "/first": 120 },
		});
		frames.clear();
		nextFrameId = 0;
		jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			nextFrameId += 1;
			frames.set(nextFrameId, callback);
			return nextFrameId;
		});
		jest.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
			frames.delete(frameId);
		});
		Object.defineProperty(performance, "getEntriesByType", { configurable: true, value: () => [] });
	});

	afterEach(() => {
		document.body.innerHTML = "";
		jest.restoreAllMocks();
		if (originalGetEntriesByType) {
			Object.defineProperty(performance, "getEntriesByType", {
				configurable: true,
				value: originalGetEntriesByType,
			});
		} else delete (performance as Partial<Performance>).getEntriesByType;
		useScrollPositionStore.getState().setRestoringScrollPosition(false);
		jest.useRealTimers();
	});

	test("keeps restoration active through the first paint when switching articles", () => {
		const view = renderHook(({ path }) => useArticleScrollPosition(articleData(path)), {
			initialProps: { path: "/first" },
		});
		expect(useScrollPositionStore.getState().isRestoringScrollPosition).toBe(true);

		view.rerender({ path: "/second" });

		expect(useScrollPositionStore.getState().isRestoringScrollPosition).toBe(true);
		act(() => runFrame(0));
		expect(useScrollPositionStore.getState().isRestoringScrollPosition).toBe(true);
		act(() => runFrame(16));
		expect(useScrollPositionStore.getState().isRestoringScrollPosition).toBe(false);
	});

	test("defers the initial scroll restoration until the next frame", () => {
		const scrollTopGetter = jest.spyOn(mockArticle, "scrollTop", "get");
		renderHook(() => useArticleScrollPosition(articleData("/first")));

		expect(scrollTopGetter).not.toHaveBeenCalled();
		expect(mockArticle.scrollTop).toBe(0);

		act(() => runFrame(0));

		expect(mockArticle.scrollTop).toBe(120);
	});

	test("cancels the initial restoration when the article changes before the next frame", () => {
		const view = renderHook(({ path }) => useArticleScrollPosition(articleData(path)), {
			initialProps: { path: "/first" },
		});

		view.rerender({ path: "/second" });
		act(() => runFrame(0));

		expect(mockArticle.scrollTop).toBe(0);
	});

	test("cancels the initial restoration when the user takes over before the next frame", () => {
		renderHook(() => useArticleScrollPosition(articleData("/first")));

		mockArticle.dispatchEvent(new WheelEvent("wheel"));
		act(() => runFrame(0));

		expect(mockArticle.scrollTop).toBe(0);
	});

	test("cancels the deferred end when the next article restores a position", () => {
		const view = renderHook(({ path }) => useArticleScrollPosition(articleData(path)), {
			initialProps: { path: "/first" },
		});
		view.rerender({ path: "/second" });
		useScrollPositionStore.getState().setPosition("/third", 240);
		view.rerender({ path: "/third" });

		act(() => {
			runFrame(0);
			runFrame(16);
		});

		expect(useScrollPositionStore.getState().isRestoringScrollPosition).toBe(true);

		view.unmount();
		act(() => {
			runFrame(32);
			runFrame(48);
		});
	});

	test("disposes the previous restoration resources only after a frame has painted", () => {
		const removeEventListener = jest.spyOn(mockArticle, "removeEventListener");
		const view = renderHook(({ path }) => useArticleScrollPosition(articleData(path)), {
			initialProps: { path: "/first" },
		});

		view.rerender({ path: "/second" });
		expect(removeEventListener).not.toHaveBeenCalledWith("keydown", expect.any(Function));

		act(() => runFrame(0));
		expect(removeEventListener).not.toHaveBeenCalledWith("keydown", expect.any(Function));

		act(() => runFrame(16));
		expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
	});

	test("does not rearm the settle timer after restoration becomes inactive", () => {
		mockArticle.firstElementChild?.append(Object.assign(document.createElement("div"), { className: "skeleton" }));
		const view = renderHook(({ path }) => useArticleScrollPosition(articleData(path)), {
			initialProps: { path: "/first" },
		});
		view.rerender({ path: "/second" });

		expect(jest.getTimerCount()).toBe(3);
		act(() => jest.advanceTimersByTime(250));
		expect(jest.getTimerCount()).toBe(2);

		act(() => {
			runFrame(0);
			runFrame(16);
		});
		expect(jest.getTimerCount()).toBe(0);
	});

	test("does not wait for lazy content that already reserves its layout", () => {
		const skeleton = Object.assign(document.createElement("div"), { className: "skeleton" });
		skeleton.dataset.layoutReserved = "true";
		mockArticle.firstElementChild?.append(skeleton);

		renderHook(() => useArticleScrollPosition(articleData("/first")));

		act(() => jest.advanceTimersByTime(250));
		act(() => {
			runFrame(0);
			runFrame(16);
		});

		expect(useScrollPositionStore.getState().isRestoringScrollPosition).toBe(false);
	});

	test("uses a timer fallback when a background tab cannot paint", () => {
		jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
		const removeEventListener = jest.spyOn(mockArticle, "removeEventListener");
		const view = renderHook(({ path }) => useArticleScrollPosition(articleData(path)), {
			initialProps: { path: "/first" },
		});

		view.rerender({ path: "/second" });

		expect(removeEventListener).not.toHaveBeenCalledWith("keydown", expect.any(Function));
		expect(frames.size).toBe(2);
		act(() => jest.advanceTimersByTime(999));
		expect(removeEventListener).not.toHaveBeenCalledWith("keydown", expect.any(Function));
		act(() => jest.advanceTimersByTime(1));
		expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
		expect(frames.size).toBe(1);
	});
});
