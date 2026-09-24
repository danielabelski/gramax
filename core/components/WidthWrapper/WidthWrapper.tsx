import { useArticleWidthStyle } from "@components/Layouts/CatalogLayout/ArticleLayout/useArticleDimensions";
import ShadowBox from "@components/WidthWrapper/ShadowBox";
import useShowMainLangContentPreview from "@core-ui/hooks/useShowMainLangContentPreview";
import { cn } from "@core-ui/utils/cn";
import { useIsDoublePanel } from "@ext/git/core/Diff/components/store/DiffViewModeStore";
import { useIsDiffView } from "@ext/git/core/Diff/logic/hooks/useIsDiffView";
import { VERTICAL_TOP_OFFSET } from "@ext/markdown/elements/table/edit/components/Helpers/consts";
import { CELL_MIN_WIDTH, PADDING_TOP_BOTTOM } from "@ext/markdown/elements/table/render/components/TableWrapper";
import {
	type ComponentProps,
	type CSSProperties,
	type RefObject,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

export interface WidthWrapperProps {
	children: JSX.Element;
	additional?: JSX.Element;
	"data-wrapper"?: string;
	tableRef?: RefObject<HTMLTableElement>;
	disableWrapper?: boolean;
	shadowBoxLeftProps?: ComponentProps<typeof ShadowBox>;
}

const WidthWrapper = (props: WidthWrapperProps) => {
	const articleWidthStyle = useArticleWidthStyle();
	const {
		children,
		"data-wrapper": dataWrapper,
		disableWrapper: disableWrapperProp,
		additional,
		shadowBoxLeftProps = {},
	} = props;
	const [rightWidth, setRightWidth] = useState(0);
	const [leftWidth, setLeftWidth] = useState(0);
	const [height, setHeight] = useState(0);

	const isShowMainLangContentPreview = useShowMainLangContentPreview();
	const isDoublePanel = useIsDoublePanel();
	const isDiffView = useIsDiffView();
	const disableWrapper = disableWrapperProp || isShowMainLangContentPreview || (isDiffView && isDoublePanel);
	const isTable = Boolean(props.tableRef);

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const measureFrameRef = useRef<number | null>(null);

	const measure = useCallback(() => {
		const scroll = scrollContainerRef.current;

		if (scroll?.firstElementChild) {
			const containerRect = scroll.getBoundingClientRect();
			const childRect = scroll.firstElementChild.getBoundingClientRect();
			const height = scroll.clientHeight;

			setLeftWidth(containerRect.left - childRect.left);
			setRightWidth(childRect.right - containerRect.right);
			setHeight(height);
		}
	}, []);

	const scheduleMeasure = useCallback(() => {
		if (measureFrameRef.current !== null) return;
		measureFrameRef.current = requestAnimationFrame(() => {
			measureFrameRef.current = null;
			measure();
		});
	}, [measure]);

	useLayoutEffect(() => {
		const scroll = scrollContainerRef.current;
		if (!scroll) return;

		const observer = new ResizeObserver(scheduleMeasure);
		observer.observe(scroll);
		if (scroll.firstElementChild) observer.observe(scroll.firstElementChild);
		window.addEventListener("resize", scheduleMeasure);
		scheduleMeasure();

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", scheduleMeasure);
			if (measureFrameRef.current !== null) {
				cancelAnimationFrame(measureFrameRef.current);
				measureFrameRef.current = null;
			}
		};
	}, [scheduleMeasure]);

	return (
		<div className={cn("width-wrapper-container", "flex justify-center", "print:justify-start print:ml-0")}>
			<div
				className={cn(
					"width-wrapper",
					"relative z-0",
					"max-w-[max(calc(var(--article-content-wrapper-width)+3em),100%)]",
					isTable && "pb-[calc(var(--padding-top-bottom)-var(--vertical-top-offset))]",
					disableWrapper && "w-full",
				)}
				data-left-shadow-visible={leftWidth > 0}
				data-wrapper={dataWrapper}
				style={
					{
						...articleWidthStyle,
						"--padding-top-bottom": PADDING_TOP_BOTTOM,
						"--vertical-top-offset": VERTICAL_TOP_OFFSET,
						"--cell-min-width": CELL_MIN_WIDTH,
					} as CSSProperties
				}
			>
				<div
					className={cn(
						"scrollableContent",
						"overflow-x-auto overflow-y-hidden relative",
						isTable && "[&>div[data-table-wrapper]]:pb-[var(--vertical-top-offset)]",

						// ColGroup sets --table-width when every column has an explicit width
						"[&.scrollableContent_table]:w-[var(--table-width,max-content)]",
						"[&.scrollableContent_table]:max-w-none",
						"[&_table_th]:min-w-[var(--cell-min-width)]",
						"[&_table_td]:min-w-[var(--cell-min-width)]",

						"print:[&.scrollableContent_table]:w-full",
						"print:[&.scrollableContent_table]:max-w-full",
						"print:[&_table_th]:min-w-0",
						"print:[&_table_td]:min-w-0",

						"print:[&_table]:w-auto",
						"print:[&_table_th]:page-break-inside-avoid",
						"print:[&_table_td]:page-break-inside-avoid",
						"print:[&_table_colgroup]:hidden",
					)}
					onScroll={scheduleMeasure}
					ref={scrollContainerRef}
				>
					{children}
				</div>
				{additional}
				<ShadowBox direction="left" height={height} width={leftWidth} {...shadowBoxLeftProps} />
				<ShadowBox direction="right" height={height} width={rightWidth} />
			</div>
		</div>
	);
};

export default WidthWrapper;
