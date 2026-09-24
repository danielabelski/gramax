import { useAutoFocusArticle } from "@ext/article/hooks/useAutoFocusArticle";
import { act, renderHook } from "@testing-library/react";

let mockArticle: HTMLDivElement;
let mockPathname = "/first";

jest.mock("@core-ui/ContextServices/ArticleRef", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest requires this module interop flag.
	__esModule: true,
	default: {
		get value() {
			return { current: mockArticle };
		},
	},
}));

jest.mock("@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider", () => ({
	useArticlePropsStore: (selector: (state: { data: { pathname: string } }) => string) =>
		selector({ data: { pathname: mockPathname } }),
}));

describe("useAutoFocusArticle", () => {
	const frames = new Map<number, FrameRequestCallback>();
	let nextFrameId = 0;

	const runNextFrame = (timestamp: number) => {
		const frame = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
		if (!frame) return;
		frames.delete(frame[0]);
		frame[1](timestamp);
	};

	beforeEach(() => {
		mockPathname = "/first";
		mockArticle = document.createElement("div");
		mockArticle.tabIndex = -1;
		document.body.append(mockArticle);
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
	});

	afterEach(() => {
		document.body.innerHTML = "";
		jest.restoreAllMocks();
	});

	test("focuses the article only after a frame has been painted", () => {
		const focus = jest.spyOn(mockArticle, "focus");
		renderHook(() => useAutoFocusArticle());

		expect(document.activeElement).not.toBe(mockArticle);
		expect(frames.size).toBe(1);

		act(() => runNextFrame(0));
		expect(document.activeElement).not.toBe(mockArticle);
		expect(frames.size).toBe(1);

		act(() => runNextFrame(16));
		expect(document.activeElement).toBe(mockArticle);
		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
	});

	test("does not focus after the article unmounts", () => {
		const view = renderHook(() => useAutoFocusArticle());
		view.unmount();

		act(() => {
			while (frames.size) runNextFrame(0);
		});

		expect(document.activeElement).not.toBe(mockArticle);
	});

	test("cancels the stale focus schedule when the pathname changes", () => {
		const view = renderHook(() => useAutoFocusArticle());
		mockPathname = "/second";
		view.rerender();

		act(() => {
			runNextFrame(0);
			runNextFrame(16);
		});

		expect(document.activeElement).toBe(mockArticle);
		expect(frames.size).toBe(0);
	});

	test("does not focus the article again when it is already active", () => {
		mockArticle.focus();
		const focus = jest.spyOn(mockArticle, "focus");
		renderHook(() => useAutoFocusArticle());

		act(() => {
			runNextFrame(0);
			runNextFrame(16);
		});

		expect(focus).not.toHaveBeenCalled();
	});

	test("preserves focus acquired inside the article during the delay", () => {
		const editor = document.createElement("div");
		editor.tabIndex = 0;
		mockArticle.append(editor);
		renderHook(() => useAutoFocusArticle());

		act(() => runNextFrame(0));
		editor.focus();
		act(() => runNextFrame(16));

		expect(document.activeElement).toBe(editor);
	});

	test("preserves new external focus acquired during the delay", () => {
		const input = document.createElement("input");
		document.body.append(input);
		renderHook(() => useAutoFocusArticle());

		act(() => runNextFrame(0));
		input.focus();
		act(() => runNextFrame(16));

		expect(document.activeElement).toBe(input);
	});
});
