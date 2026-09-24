import { act, renderHook } from "@testing-library/react";
import type { TransitionEvent } from "react";
import { useLazyAnimatedPresence } from "./useLazyAnimatedPresence";

describe("useLazyAnimatedPresence", () => {
	let nextFrameId: number;
	let pendingFrames: Map<number, FrameRequestCallback>;

	beforeEach(() => {
		jest.useFakeTimers();
		nextFrameId = 0;
		pendingFrames = new Map();
		jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			const frameId = ++nextFrameId;
			pendingFrames.set(frameId, callback);
			return frameId;
		});
		jest.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
			pendingFrames.delete(frameId);
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	const runNextFrame = () => {
		const nextFrame = pendingFrames.entries().next().value as [number, FrameRequestCallback] | undefined;
		if (!nextFrame) throw new Error("Expected a pending animation frame");

		pendingFrames.delete(nextFrame[0]);
		act(() => nextFrame[1](0));
	};

	const finishTransition = (onTransitionEnd: (event: TransitionEvent<HTMLElement>) => void) => {
		const element = document.createElement("div");
		act(() =>
			onTransitionEnd({ target: element, currentTarget: element } as unknown as TransitionEvent<HTMLElement>),
		);
	};

	const renderPresence = () =>
		renderHook(
			({ closeImmediately = false, forceOpen = false, isOpen = false }) =>
				useLazyAnimatedPresence({ closeImmediately, exitFallbackMs: 250, forceOpen, isOpen }),
			{
				initialProps: { closeImmediately: false, forceOpen: false, isOpen: false },
			},
		);

	test("paints the hidden state for one frame before becoming visible", () => {
		const { result, rerender } = renderPresence();

		rerender({ closeImmediately: false, forceOpen: false, isOpen: true });
		expect(result.current).toMatchObject({ isPresent: true, isVisible: false });

		runNextFrame();
		expect(result.current.isVisible).toBe(false);

		runNextFrame();
		expect(result.current.isVisible).toBe(true);
	});

	test("keeps content present until its exit transition finishes", () => {
		const { result, rerender } = renderPresence();
		rerender({ closeImmediately: false, forceOpen: false, isOpen: true });
		runNextFrame();
		runNextFrame();

		rerender({ closeImmediately: false, forceOpen: false, isOpen: false });
		expect(result.current).toMatchObject({ isPresent: true, isVisible: false });

		finishTransition(result.current.onTransitionEnd);
		expect(result.current.isPresent).toBe(false);
	});

	test("ignores an old exit transition when content reopens", () => {
		const { result, rerender } = renderPresence();
		rerender({ closeImmediately: false, forceOpen: false, isOpen: true });
		runNextFrame();
		runNextFrame();

		rerender({ closeImmediately: false, forceOpen: false, isOpen: false });
		rerender({ closeImmediately: false, forceOpen: false, isOpen: true });
		finishTransition(result.current.onTransitionEnd);

		expect(result.current).toMatchObject({ isPresent: true, isVisible: true });
	});

	test("shows forced content immediately and removes it immediately when forcing ends", () => {
		const { result, rerender } = renderPresence();

		rerender({ closeImmediately: false, forceOpen: true, isOpen: false });
		expect(result.current).toMatchObject({ isPresent: true, isVisible: true });
		expect(pendingFrames.size).toBe(0);

		rerender({ closeImmediately: false, forceOpen: false, isOpen: false });
		expect(result.current).toMatchObject({ isPresent: false, isVisible: false });
	});

	test("skips the exit transition when immediate close is requested", () => {
		const { result, rerender } = renderPresence();
		rerender({ closeImmediately: false, forceOpen: false, isOpen: true });
		runNextFrame();
		runNextFrame();

		rerender({ closeImmediately: true, forceOpen: false, isOpen: false });
		expect(result.current).toMatchObject({ isPresent: false, isVisible: false });
	});

	test("uses the fallback when transitions do not emit an end event", () => {
		const { result, rerender } = renderPresence();
		rerender({ closeImmediately: false, forceOpen: false, isOpen: true });
		runNextFrame();
		runNextFrame();

		rerender({ closeImmediately: false, forceOpen: false, isOpen: false });
		act(() => jest.advanceTimersByTime(249));
		expect(result.current.isPresent).toBe(true);

		act(() => jest.advanceTimersByTime(1));
		expect(result.current.isPresent).toBe(false);
	});
});
