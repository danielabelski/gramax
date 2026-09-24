import { classNames } from "@components/libs/classNames";
import useDragScrolling from "@core-ui/hooks/useDragScrolling";
import useMediaQuery from "@core-ui/hooks/useMediaQuery";
import { cssMedia } from "@core-ui/utils/cssUtils";
import scrollUtils from "@core-ui/utils/scrollUtils";
// biome-ignore lint/style/noRestrictedImports: migrating this legacy component's dynamic shadows is a separate change.
import styled from "@emotion/styled";
import {
	type CSSProperties,
	forwardRef,
	type MutableRefObject,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

interface ScrollableProps {
	children: ReactNode;
	showTopBottomShadow?: boolean;
	boxShadowStyles?: { top?: string; bottom?: string };
	onScroll?: (isTop: boolean, isBottom: boolean) => void;
	hasScroll?: (hasScroll: boolean) => void;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
	dragScrolling?: boolean;
	style?: CSSProperties;
	className?: string;
}

const Scrollable = forwardRef((props: ScrollableProps, ref: MutableRefObject<HTMLDivElement>) => {
	const {
		children,
		onScroll,
		hasScroll,
		onMouseEnter,
		onMouseLeave,
		className,
		showTopBottomShadow = true,
		dragScrolling = true,
		style,
	} = props;
	const [containerWidth, setContainerWidth] = useState(0);
	const containerRef = ref || useRef<HTMLDivElement>(null);
	const [hasElementScroll, setHasElementScroll] = useState(false);
	const hasScrollRef = useRef(hasScroll);
	const lastHasScrollRef = useRef<boolean | null>(null);
	const narrowMedia = useMediaQuery(cssMedia.JSnarrow);

	const [isBottom, setIsBottom] = useState(false);
	const [isTop, setIsTop] = useState(true);
	const [dragScrollingState] = useState(dragScrolling);

	hasScrollRef.current = hasScroll;

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const contentWrapper = container.firstElementChild;
		if (!contentWrapper) return;

		let frameId: number | null = null;
		let contentElements = new Set(contentWrapper.children);

		const measure = () => {
			frameId = null;

			const rect = container.getBoundingClientRect();
			const { clientHeight, scrollHeight, scrollTop } = container;

			const scroll = scrollHeight > 0 && clientHeight > 0 && Math.abs(scrollHeight - clientHeight) > 1;
			const nextIsTop = scrollTop < 2;
			const nextIsBottom = scrollHeight - scrollTop - clientHeight < 2;

			setContainerWidth((current) => (current === rect.width ? current : rect.width));
			setHasElementScroll((current) => (current === scroll ? current : scroll));
			setIsTop((current) => (current === nextIsTop ? current : nextIsTop));
			setIsBottom((current) => (current === nextIsBottom ? current : nextIsBottom));

			if (lastHasScrollRef.current !== scroll) {
				lastHasScrollRef.current = scroll;
				hasScrollRef.current?.(scroll);
			}
		};

		const scheduleMeasure = () => {
			if (frameId !== null) return;
			frameId = requestAnimationFrame(measure);
		};

		const resizeObserver = new ResizeObserver(scheduleMeasure);
		const mutationObserver = new MutationObserver(() => {
			const nextContentElements = new Set(contentWrapper.children);
			for (const element of contentElements) {
				if (!nextContentElements.has(element)) resizeObserver.unobserve(element);
			}
			for (const element of nextContentElements) {
				if (!contentElements.has(element)) resizeObserver.observe(element);
			}
			contentElements = nextContentElements;
			scheduleMeasure();
		});

		resizeObserver.observe(container);
		for (const element of contentElements) resizeObserver.observe(element);
		mutationObserver.observe(contentWrapper, { childList: true });

		return () => {
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			if (frameId !== null) cancelAnimationFrame(frameId);
		};
	}, [containerRef]);

	if (dragScrollingState) useDragScrolling(containerRef, 30);

	return (
		<div
			className={classNames(className, {
				"has-top-shadow": showTopBottomShadow && hasElementScroll && !isTop,
				"has-bottom-shadow": showTopBottomShadow && hasElementScroll && !isBottom,
				"is-mobile": narrowMedia,
				"no-scroll": !hasElementScroll,
			})}
			onMouseEnter={() => {
				if (onMouseEnter) onMouseEnter();
			}}
			onMouseLeave={() => {
				if (onMouseLeave) onMouseLeave();
			}}
			onScroll={() => {
				if (!containerRef.current) return;
				const isTop = scrollUtils.scrollPositionIsTop(containerRef.current);
				const isBottom = scrollUtils.scrollPositionIsBottom(containerRef.current);
				setIsTop(isTop);
				setIsBottom(isBottom);
				onScroll?.(isTop, isBottom);
			}}
			ref={containerRef}
			style={style}
		>
			<div
				className="scrolling-content"
				style={containerWidth ? Object.assign({ width: containerWidth }, style) : style}
			>
				{children}
			</div>
		</div>
	);
});

export default styled(Scrollable)`
	width: inherit;
	height: inherit;
	position: relative;
	overflow: hidden;

	&.has-top-shadow {
		box-shadow: ${({ boxShadowStyles }) =>
			boxShadowStyles?.top || `0px 6px 5px -5px var(--color-diff-entries-shadow) inset`};
	}

	&.has-bottom-shadow {
		box-shadow: ${({ boxShadowStyles }) =>
			boxShadowStyles?.bottom || `0px -6px 5px -5px var(--color-diff-entries-shadow) inset`};
	}

	&.has-top-shadow.has-bottom-shadow {
		box-shadow: ${({ boxShadowStyles }) => `${
			boxShadowStyles?.top || `0px 6px 5px -5px var(--color-diff-entries-shadow) inset`
		},
				${boxShadowStyles?.bottom || `0px -6px 5px -5px var(--color-diff-entries-shadow) inset`}
			`};
	}

	&:hover,
	&.is-mobile {
		overflow-y: auto;
	}

	::-webkit-scrollbar {
		height: var(--scroll-width);
		width: var(--scroll-width);
	}

	.scrolling-content {
		height: 100%;
	}

	&.no-scroll {
		overflow-y: hidden;
	}
`;
