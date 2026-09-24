import type { ArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import ArticleRefService from "@core-ui/ContextServices/ArticleRef";
import { useArticleViewKey } from "@core-ui/ContextServices/views/articleView/ArticleViewKey";
import { useScrollPositionStore } from "@core-ui/stores/ScrollPositionStore";
import NavigationEvents from "@ext/navigation/NavigationEvents";
import { useEffect, useLayoutEffect, useRef } from "react";

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"]);

const SETTLE_MS = 250;
const MAX_RESTORE_MS = 4000;
const DISPOSE_FALLBACK_MS = 1000;
const POSITION_TOLERANCE_PX = 1;

let restoreEndPaintFrame: number | undefined;
let restoreEndFrame: number | undefined;

const cancelRestoreEnd = () => {
	if (restoreEndPaintFrame !== undefined) cancelAnimationFrame(restoreEndPaintFrame);
	if (restoreEndFrame !== undefined) cancelAnimationFrame(restoreEndFrame);
	restoreEndPaintFrame = undefined;
	restoreEndFrame = undefined;
};

const setRestoringScrollPosition = (active: boolean) => {
	if (active) {
		cancelRestoreEnd();
		const store = useScrollPositionStore.getState();
		if (!store.isRestoringScrollPosition) store.setRestoringScrollPosition(true);
		return;
	}

	if (restoreEndPaintFrame !== undefined || restoreEndFrame !== undefined) return;
	restoreEndPaintFrame = requestAnimationFrame(() => {
		restoreEndPaintFrame = undefined;
		restoreEndFrame = requestAnimationFrame(() => {
			restoreEndFrame = undefined;
			const store = useScrollPositionStore.getState();
			if (store.isRestoringScrollPosition) store.setRestoringScrollPosition(false);
		});
	});
};

// An `#anchor` or `:~:text=` fragment in the URL — those handlers own the scroll, so we don't restore.
const urlHasScrollTarget = (): boolean => {
	if (typeof window === "undefined") return false;
	if (window.location.hash.length > 1) return true;
	// location.hash drops the `:~:` directive, so the raw navigation URL is the only source.
	const navUrl = (performance.getEntriesByType("navigation") as PerformanceNavigationTiming[])[0]?.name ?? "";
	return navUrl.includes(":~:");
};

// Images, diagrams, drawio and video all render a `.skeleton` placeholder until they're ready.
// A skeleton with reserved layout can stay lazy without holding scroll restoration open.
const hasPendingContent = (container: HTMLElement): boolean =>
	container.querySelector(".skeleton:not([data-layout-reserved])") !== null;

// Calls `onChange` whenever the article's rendered height may have moved: element resize,
// DOM mutations, or an image finishing — the last covers images with no reserved space.
const observeHeightChanges = (container: HTMLElement, onChange: () => void): (() => void) => {
	const cleanups: (() => void)[] = [];

	const wrapper = container.firstElementChild;
	if (wrapper && "ResizeObserver" in window) {
		const resizeObserver = new ResizeObserver(onChange);
		resizeObserver.observe(wrapper);
		cleanups.push(() => resizeObserver.disconnect());
	}

	const mutationObserver = new MutationObserver(onChange);
	mutationObserver.observe(container, { subtree: true, childList: true });
	cleanups.push(() => mutationObserver.disconnect());

	for (const img of container.querySelectorAll("img")) {
		if (img.complete) continue;
		img.addEventListener("load", onChange, { once: true });
		img.addEventListener("error", onChange, { once: true });
		cleanups.push(() => {
			img.removeEventListener("load", onChange);
			img.removeEventListener("error", onChange);
		});
	}

	return () => cleanups.forEach((cleanup) => cleanup());
};

// Calls `onTakeover` the first time the user scrolls the container themselves.
const observeUserTakeover = (container: HTMLElement, onTakeover: () => void): (() => void) => {
	const cleanups: (() => void)[] = [];

	const onKeyDown = (e: KeyboardEvent) => {
		if (SCROLL_KEYS.has(e.key)) onTakeover();
	};
	container.addEventListener("keydown", onKeyDown);
	cleanups.push(() => container.removeEventListener("keydown", onKeyDown));

	for (const evt of ["wheel", "touchstart", "pointerdown"] as const) {
		container.addEventListener(evt, onTakeover, { passive: true });
		cleanups.push(() => container.removeEventListener(evt, onTakeover));
	}

	return () => cleanups.forEach((cleanup) => cleanup());
};

/**
 * Holds the container at `target`, re-applying it through every height change —
 * the saved offset is a pixel value that only maps back to the same
 * content once the layout above it is final.
 **/
const restoreScrollPosition = (
	container: HTMLElement,
	target: number,
	onActiveChange: (active: boolean) => void,
): (() => void) => {
	let active = true;
	let disposed = false;
	let applyFrame: number | null = null;
	let settleTimer: ReturnType<typeof setTimeout> | null = null;
	let hardTimer: ReturnType<typeof setTimeout> | null = null;
	let disposePaintFrame: number | null = null;
	let disposeFrame: number | null = null;
	let disposeFallbackTimer: ReturnType<typeof setTimeout> | null = null;
	const cleanups: (() => void)[] = [];

	const apply = () => {
		if (Math.abs(container.scrollTop - target) > POSITION_TOLERANCE_PX) container.scrollTop = target;
	};

	const dispose = () => {
		if (disposed) return;
		disposed = true;
		if (settleTimer) clearTimeout(settleTimer);
		if (hardTimer) clearTimeout(hardTimer);
		if (applyFrame !== null) cancelAnimationFrame(applyFrame);
		if (disposePaintFrame !== null) cancelAnimationFrame(disposePaintFrame);
		if (disposeFrame !== null) cancelAnimationFrame(disposeFrame);
		if (disposeFallbackTimer) clearTimeout(disposeFallbackTimer);
		cleanups.forEach((cleanup) => cleanup());
	};

	const disposeAfterPaint = () => {
		disposeFallbackTimer = setTimeout(dispose, DISPOSE_FALLBACK_MS);
		disposePaintFrame = requestAnimationFrame(() => {
			disposePaintFrame = null;
			disposeFrame = requestAnimationFrame(() => {
				disposeFrame = null;
				dispose();
			});
		});
	};

	const stop = (applyFinal: boolean, deferDisposal = false) => {
		if (!active) return;
		active = false;
		if (applyFrame !== null) {
			cancelAnimationFrame(applyFrame);
			applyFrame = null;
		}
		if (applyFinal) apply();
		onActiveChange(false);
		if (!deferDisposal) {
			dispose();
			return;
		}
		disposeAfterPaint();
	};

	// Re-arm a countdown that finishes the restore once the layout has been quiet for SETTLE_MS
	// with no loading blocks left; otherwise keep waiting for them to render.
	const waitUntilSettled = () => {
		if (!active) return;
		if (settleTimer) clearTimeout(settleTimer);
		settleTimer = setTimeout(() => {
			if (!active) return;
			if (hasPendingContent(container)) waitUntilSettled();
			else stop(true);
		}, SETTLE_MS);
	};

	const onHeightChange = () => {
		if (!active) return;
		apply();
		waitUntilSettled();
	};

	onActiveChange(true);
	cleanups.push(observeHeightChanges(container, onHeightChange));
	cleanups.push(observeUserTakeover(container, () => stop(false)));

	applyFrame = requestAnimationFrame(() => {
		applyFrame = null;
		if (active) apply();
	});
	waitUntilSettled();
	hardTimer = setTimeout(() => stop(true), MAX_RESTORE_MS);

	return () => stop(false, true);
};

const useArticleScrollPosition = (data: ArticlePageData) => {
	const articleRef = ArticleRefService.value;
	const currentArticlePath = data?.articleProps?.ref?.path;
	const isRestoringRef = useRef(false);
	const view = useArticleViewKey();

	useEffect(() => {
		const token = NavigationEvents.on("item-rename", ({ from, patch, view: renamedView }) => {
			if (view !== null && renamedView !== view) return;
			useScrollPositionStore.getState().movePosition(from.path, patch.ref.path);
		});
		return () => NavigationEvents.off(token);
	}, [view]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: it's ok
	useLayoutEffect(() => {
		const container = articleRef?.current;
		if (!container || !currentArticlePath) return;
		if (urlHasScrollTarget()) return;

		const savedPosition = useScrollPositionStore.getState().getPosition(currentArticlePath);
		if (savedPosition == null) {
			container.scrollTop = 0;
			return;
		}

		return restoreScrollPosition(container, savedPosition, (active) => {
			isRestoringRef.current = active;
			setRestoringScrollPosition(active);
		});
	}, [currentArticlePath, articleRef]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: it's ok
	useEffect(() => {
		const container = articleRef?.current;
		if (!container || !currentArticlePath) return;

		const saveScrollPosition = () => {
			// Skip our own restore and other features' programmatic scrolls so they don't overwrite the saved offset.
			if (isRestoringRef.current || useScrollPositionStore.getState().isProgrammaticScroll) return;
			useScrollPositionStore.getState().setPosition(currentArticlePath, container.scrollTop);
		};

		container.addEventListener("scroll", saveScrollPosition, { passive: true });
		return () => container.removeEventListener("scroll", saveScrollPosition);
	}, [currentArticlePath, articleRef]);
};

export default useArticleScrollPosition;
