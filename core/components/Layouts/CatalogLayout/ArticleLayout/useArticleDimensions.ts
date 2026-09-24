import {
	type CSSProperties,
	createContext,
	useContext,
	useLayoutEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { ARTICLE_CONTENT_WRAPPER_WIDTH_ATTRIBUTE } from "./consts";

type WidthListener = (width: number) => void;

// One observer per article, including shared containers used by multiple media blocks.
// ResizeObserver supplies the measurements: consumers never read layout after another consumer writes it.
export const createArticleDimensions = () => {
	let articleWidth = 0;
	let observer: ResizeObserver | undefined;
	const articleListeners = new Set<() => void>();
	const targets = new Map<Element, { width?: number; listeners: Set<WidthListener> }>();

	return {
		getWidth: () => articleWidth,
		subscribe: (listener: () => void) => {
			articleListeners.add(listener);
			return () => {
				articleListeners.delete(listener);
			};
		},
		setWidth: (width: number) => {
			if (width === articleWidth) return;
			articleWidth = width;
			articleListeners.forEach((listener) => listener());
		},
		observe: (element: Element, listener: WidthListener) => {
			if (!observer) {
				observer = new ResizeObserver((entries) => {
					const notifications: (() => void)[] = [];
					for (const entry of entries) {
						const target = targets.get(entry.target);
						const width = entry.contentRect.width;
						if (!target || target.width === width) continue;
						target.width = width;
						for (const callback of target.listeners) notifications.push(() => callback(width));
					}
					notifications.forEach((notify) => notify());
				});
			}
			let target = targets.get(element);
			if (!target) {
				target = { listeners: new Set() };
				targets.set(element, target);
				observer.observe(element);
			}
			target.listeners.add(listener);
			if (target.width !== undefined) listener(target.width);
			return () => {
				target.listeners.delete(listener);
				if (target.listeners.size) return;
				targets.delete(element);
				observer?.unobserve(element);
				if (!targets.size) {
					observer?.disconnect();
					observer = undefined;
				}
			};
		},
	};
};

export const ArticleDimensionsContext = createContext<ReturnType<typeof createArticleDimensions> | null>(null);
const emptySubscribe = () => () => {};
const zeroWidth = () => 0;

export const useArticleWidth = () => {
	const dimensions = useContext(ArticleDimensionsContext);
	return useSyncExternalStore(dimensions?.subscribe ?? emptySubscribe, dimensions?.getWidth ?? zeroWidth, zeroWidth);
};

export const useArticleWidthStyle = (): CSSProperties => {
	const width = useArticleWidth();
	return width ? ({ [ARTICLE_CONTENT_WRAPPER_WIDTH_ATTRIBUTE]: `${width}px` } as CSSProperties) : undefined;
};

export const useArticleContainerWidth = (getContainer: () => Element | null) => {
	const sharedDimensions = useContext(ArticleDimensionsContext);
	const dimensions = useMemo(() => sharedDimensions ?? createArticleDimensions(), [sharedDimensions]);
	const [width, setWidth] = useState(0);
	useLayoutEffect(() => {
		const container = getContainer();
		if (!container) return;
		return dimensions.observe(container, setWidth);
	}, [dimensions, getContainer]);
	return width;
};
