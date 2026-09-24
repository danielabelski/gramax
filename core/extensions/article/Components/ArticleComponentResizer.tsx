import {
	useArticleContainerWidth,
	useArticleWidth,
} from "@components/Layouts/CatalogLayout/ArticleLayout/useArticleDimensions";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { useTouchHandler } from "@core-ui/hooks/useTouchHandler";
import { cn } from "@core-ui/utils/cn";
import getScale from "@ext/markdown/elements/image/render/logic/getScale";
import {
	type HTMLAttributes,
	type ReactElement,
	type ReactNode,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { tv } from "tailwind-variants";

type Scale = number | string;

interface ArticleComponentResizerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
	selected?: boolean;
	scale?: Scale;
	defaultScale?: Scale;
	children?: ReactNode;
	disabled?: boolean;
	onChange?: (resize: string) => void;
	isPrint?: boolean;
}

const styles = tv({
	slots: {
		resizer: [
			"absolute -right-0.5 top-[50%] translate-y-[-50%] z-10",
			"border-2 border-[var(--color-focus)] w-1.5 h-full rounded-lg bg-white",
			"flex items-center max-h-[max(25%,1.5em)] transition-opacity duration-150 ease-in-out",
			"pointer-events-none cursor-col-resize",
		],
		container: [
			"mx-auto relative [&>.resizer]:pointer-events-none [&>.resizer]:hover:pointer-events-auto [&>.resizer][data-selected=true]:pointer-events-auto",
			"[&>.resizer]:opacity-0 [&>.resizer]:hover:opacity-100 [&>[aria-hidden=false]]:opacity-100",
		],
	},
});

export const ArticleComponentResizer = (props: ArticleComponentResizerProps): ReactElement => {
	const { className, scale, selected = false, onChange, children, disabled, defaultScale, isPrint, ...rest } = props;
	const [isFullArticle, setIsFullArticle] = useState(false);
	const isReadOnly = PageDataContextService.value.conf.isReadOnly;

	const containerRef = useRef<HTMLDivElement>(null);
	const dragHandleRef = useRef<HTMLElement | null>(null);
	const startWidthRef = useRef<number>(0);
	const startClientXRef = useRef<number>(0);
	const articleWidth = useArticleWidth();

	const getContainer = useCallback(() => {
		const component = containerRef.current;
		if (!component) return null;
		const container = component.closest("[data-resize-container]") ?? component.closest("[data-component]");
		// Observe the available column, not the element whose width we are changing.
		return container?.parentElement ?? component.parentElement?.parentElement;
	}, []);
	const containerWidth = useArticleContainerWidth(getContainer);

	const hasFloat = useCallback(() => {
		const container = containerRef.current.closest("[data-float]");
		return !!container;
	}, []);

	const isNested = useCallback(() => {
		const el = containerRef.current;
		const component = el.closest("[data-component]");
		// Check is nested in other components like table cells, list items, notes and others
		return !!component?.parentElement?.closest("[data-component], td, th") || !!el.closest("td, th");
	}, []);

	const handleResizeStart = useCallback((startX: number) => {
		const mainContainer = containerRef.current;
		startWidthRef.current = mainContainer.offsetWidth;
		startClientXRef.current = startX;
		const nodeViewWrapper = mainContainer.closest("[data-drag-handle]");
		if (!nodeViewWrapper) return;
		dragHandleRef.current = nodeViewWrapper as HTMLElement;
		nodeViewWrapper.removeAttribute("data-drag-handle");
	}, []);

	const handleResizeMove = useCallback(
		(_deltaX: number, _deltaY: number, clientX: number) => {
			const object = containerRef.current;
			const container = getContainer();

			if (!object || !container) return;

			const currentHeight = object.offsetHeight;
			const newWidth = startWidthRef.current + (clientX - startClientXRef.current);
			const aspectRatio = startWidthRef.current / currentHeight;
			const newHeight = newWidth / aspectRatio;

			const isFloat = hasFloat();
			const nested = isNested();

			const articleMaxWidth = containerWidth;
			const minWidth = 2.5 * parseFloat(getComputedStyle(object).fontSize);
			const fullArticleWidth = isFloat || nested ? articleMaxWidth : articleWidth || articleMaxWidth;

			const snapThreshold = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2;
			const distanceToMax = Math.abs(newWidth - articleMaxWidth);
			const snappedToMax = distanceToMax < snapThreshold;
			const effectiveWidth = snappedToMax ? articleMaxWidth : newWidth;

			if (effectiveWidth >= fullArticleWidth) {
				object.style.width = `${fullArticleWidth}px`;
			} else if (newHeight <= minWidth || newWidth <= minWidth) {
				const adjustedWidth = minWidth * aspectRatio;
				object.style.width = `${adjustedWidth}px`;
			} else {
				object.style.width = `${effectiveWidth}px`;
			}

			setIsFullArticle(!nested && effectiveWidth > articleMaxWidth);
		},
		[getContainer, articleWidth, containerWidth, hasFloat, isNested],
	);

	const handleResizeEnd = useCallback(() => {
		const nodeViewWrapper = dragHandleRef.current;
		if (nodeViewWrapper) {
			nodeViewWrapper.setAttribute("data-drag-handle", "true");
			dragHandleRef.current = null;
		}

		const object = containerRef.current;
		if (!object) return;

		const finalWidth = object.offsetWidth;
		onChange(`${finalWidth}px`);
	}, [onChange]);

	const { onPointerDown, onTouchStart, onMouseDown } = useTouchHandler({
		onStart: handleResizeStart,
		onMove: (deltaX, deltaY, clientX) => handleResizeMove(deltaX, deltaY, clientX),
		onEnd: handleResizeEnd,
	});

	useLayoutEffect(() => {
		const currentScale = scale ?? defaultScale;

		const applyScale = (newScale: number | string) => {
			const component = containerRef.current;
			if (!component) return false;

			if (!newScale) {
				component.style.removeProperty("width");
				return true;
			}

			const articleMaxWidth = containerWidth;
			if (!articleMaxWidth) return false;

			const nested = isNested();
			const fullArticleWidth = nested ? articleMaxWidth : articleWidth || articleMaxWidth;

			let width: number;
			if (typeof newScale === "string" && newScale.endsWith("px")) {
				width = parseFloat(newScale);
			} else {
				const scaleNum = typeof newScale === "string" ? parseFloat(newScale) : newScale;
				width =
					scaleNum <= 100
						? getScale(scaleNum, articleMaxWidth)
						: articleMaxWidth + ((scaleNum - 100) / 100) * (fullArticleWidth - articleMaxWidth);
			}

			width = Math.min(width, fullArticleWidth);

			setIsFullArticle(!nested && width > articleMaxWidth);
			const nextWidth = `${width}px`;
			if (component.style.width !== nextWidth) component.style.width = nextWidth;
			return true;
		};

		applyScale(currentScale);
	}, [scale, defaultScale, articleWidth, containerWidth, isNested]);

	const { resizer, container } = styles();
	return (
		<div
			className="flex"
			style={
				isFullArticle && !isPrint
					? {
							width: articleWidth || undefined,
							maxWidth: articleWidth || undefined,
							marginLeft: articleWidth ? `calc((${articleWidth}px - 100%) / -2)` : undefined,
						}
					: undefined
			}
		>
			<div
				className={cn(className, container())}
				ref={containerRef}
				style={{ maxWidth: articleWidth || "100%" }}
				{...rest}
			>
				{children}
				{!disabled && !isReadOnly && (
					<div
						aria-hidden={!selected}
						className={cn("resizer", resizer())}
						data-selected={selected}
						data-testid="component-resizer"
						onMouseDown={onMouseDown}
						onPointerDown={onPointerDown}
						onTouchStart={onTouchStart}
					/>
				)}
			</div>
		</div>
	);
};
