import { type TransitionEvent, useCallback, useEffect, useRef, useState } from "react";

interface LazyAnimatedPresenceOptions {
	isOpen: boolean;
	forceOpen?: boolean;
	closeImmediately?: boolean;
	exitFallbackMs: number;
}

export const useLazyAnimatedPresence = ({
	isOpen,
	forceOpen = false,
	closeImmediately = false,
	exitFallbackMs,
}: LazyAnimatedPresenceOptions) => {
	const [isPresent, setIsPresent] = useState(false);
	const [isVisible, setIsVisible] = useState(false);
	const isPresentRef = useRef(false);
	const isVisibleRef = useRef(false);
	const wasForcedOpenRef = useRef(false);
	const enterFrameRef = useRef<number | null>(null);
	const exitFallbackRef = useRef<number | null>(null);

	const updatePresence = useCallback((present: boolean) => {
		if (isPresentRef.current === present) return;
		isPresentRef.current = present;
		setIsPresent(present);
	}, []);

	const updateVisibility = useCallback((visible: boolean) => {
		if (isVisibleRef.current === visible) return;
		isVisibleRef.current = visible;
		setIsVisible(visible);
	}, []);

	useEffect(() => {
		if (exitFallbackRef.current !== null) window.clearTimeout(exitFallbackRef.current);
		exitFallbackRef.current = null;

		if (forceOpen) {
			if (enterFrameRef.current !== null) cancelAnimationFrame(enterFrameRef.current);
			enterFrameRef.current = null;
			wasForcedOpenRef.current = true;
			updatePresence(true);
			updateVisibility(true);
			return;
		}

		if (isOpen) {
			wasForcedOpenRef.current = false;
			if (isPresentRef.current) {
				updateVisibility(true);
				return;
			}

			updatePresence(true);
			// One frame commits the hidden state; the next starts an animatable transition from it.
			enterFrameRef.current = requestAnimationFrame(() => {
				enterFrameRef.current = requestAnimationFrame(() => {
					enterFrameRef.current = null;
					updateVisibility(true);
				});
			});
			return;
		}

		const wasForcedOpen = wasForcedOpenRef.current;
		wasForcedOpenRef.current = false;
		const leftBeforeEntrance = enterFrameRef.current !== null;
		if (enterFrameRef.current !== null) cancelAnimationFrame(enterFrameRef.current);
		enterFrameRef.current = null;
		const wasVisible = isVisibleRef.current;
		updateVisibility(false);

		if (!isPresentRef.current) return;
		if (closeImmediately || wasForcedOpen || leftBeforeEntrance || !wasVisible) {
			updatePresence(false);
			return;
		}

		exitFallbackRef.current = window.setTimeout(() => {
			exitFallbackRef.current = null;
			updatePresence(false);
		}, exitFallbackMs);
	}, [closeImmediately, exitFallbackMs, forceOpen, isOpen, updatePresence, updateVisibility]);

	useEffect(
		() => () => {
			if (enterFrameRef.current !== null) cancelAnimationFrame(enterFrameRef.current);
			if (exitFallbackRef.current !== null) window.clearTimeout(exitFallbackRef.current);
		},
		[],
	);

	const onTransitionEnd = useCallback(
		(event: TransitionEvent<HTMLElement>) => {
			if (event.target !== event.currentTarget || isOpen || forceOpen) return;
			if (exitFallbackRef.current !== null) window.clearTimeout(exitFallbackRef.current);
			exitFallbackRef.current = null;
			updatePresence(false);
		},
		[forceOpen, isOpen, updatePresence],
	);

	return { isPresent, isVisible, onTransitionEnd };
};
