import { LEFT_NAV_CLASS } from "@app/config/const";
import { useSidebarsWidthStore } from "@core-ui/ContextServices/Sidebars/SidebarsWidthStore";
import useLeftNavigationWidthVar from "@core-ui/hooks/useLeftNavigationWidthVar";
import { SIDEBAR_TRIGGER_ATTR } from "@core-ui/hooks/useSidebarFloating";
import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import {
	NAVIGATION_HOVER_ID_ATTR,
	useNavigationTreeStore,
} from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import {
	LEFT_NAV_DEFAULT_WIDTH,
	LEFT_NAV_MAX_WIDTH,
	LEFT_NAV_MIN_WIDTH,
} from "@ext/navigation/catalog/SidebarNavigation/utils/constants";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, SidebarResizer } from "@ui-kit/Sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import {
	type CSSProperties,
	type PointerEvent,
	type Ref,
	type TransitionEventHandler,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";
import { LeftNavigationSlot } from "./LeftNavigationSlot";

const NAV_Z_INDEX = "z-[var(--z-index-nav-layout)]";
const NAV_Z_INDEX_VALUE = "var(--z-index-nav-layout)";
const COLLAPSED_TOOLBAR_HEIGHT = 40;
const COLLAPSED_PANEL_OFFSET = COLLAPSED_TOOLBAR_HEIGHT + VIEWPORT_PADDING;

// The rail is centred on the sidebar wrapper edge; the collapsed panel sits VIEWPORT_PADDING inside it.
const RAIL_HALF_WIDTH = 2.5;
const COLLAPSED_RAIL_STYLE: CSSProperties = {
	top: VIEWPORT_PADDING,
	bottom: VIEWPORT_PADDING,
	right: VIEWPORT_PADDING - RAIL_HALF_WIDTH,
	transform: "none",
};

// Breakpoints use the mobile snapshot during SSR; the bootstrap attribute already has the saved desktop state.
const INITIAL_DESKTOP_POSITION =
	"lg:[html[data-left-sidebar-pinned=true]_&]:!left-0 lg:[html[data-left-sidebar-pinned=false]_&]:!left-[calc(var(--sidebar-width)*-1)]";

const EDGE_TO_EDGE_PANEL = [
	"[&>[data-sidebar=sidebar]]:!overflow-hidden",
	"[&>[data-sidebar=sidebar]]:!rounded-none",
	"[&>[data-sidebar=sidebar]]:!border-y-0",
	"[&>[data-sidebar=sidebar]]:!border-l-0",
	"[&>[data-sidebar=sidebar]]:!bg-primary-bg",
	"[&>[data-sidebar=sidebar]]:!shadow-none",
].join(" ");

const FLOATING_PANEL = [
	"[&>[data-sidebar=sidebar]]:!overflow-hidden",
	"[&>[data-sidebar=sidebar]]:!rounded-xl",
	"[&>[data-sidebar=sidebar]]:!bg-primary-bg",
	"[&>[data-sidebar=sidebar]]:!shadow-glass-lg",
].join(" ");

interface LeftNavigationLayoutProps {
	leftNavigationContent: JSX.Element;
	leftNavigationTop?: JSX.Element;
	leftNavigationBottom?: JSX.Element;
	isVisible: boolean;
	isCollapsed: boolean;
	isMobile?: boolean;
	onTransitionEnd?: TransitionEventHandler<HTMLDivElement>;
	sidebarRef?: Ref<HTMLDivElement>;
}

const LeftNavigationLayout = ({
	leftNavigationContent,
	leftNavigationTop,
	leftNavigationBottom,
	isVisible,
	isCollapsed,
	isMobile,
	onTransitionEnd,
	sidebarRef,
}: LeftNavigationLayoutProps) => {
	const width = useSidebarsWidthStore((state) => state.leftWidth);
	const setLeftWidth = useSidebarsWidthStore((state) => state.setLeftWidth);
	const setWidthVar = useLeftNavigationWidthVar();
	const navigationRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	useImperativeHandle(sidebarRef, () => navigationRef.current);
	const previewWidth = useCallback((nextWidth: number) => {
		// Keep drag updates inside the fixed navigation; the article uses the committed root width.
		for (const element of [navigationRef.current, bottomRef.current]) {
			element?.style.setProperty("--sidebar-width", `${nextWidth}px`);
		}
	}, []);
	useLayoutEffect(() => {
		previewWidth(width);
	}, [width, previewWidth]);
	const [isResizing, setIsResizing] = useState(false);
	const setHoveredNavigationId = useNavigationTreeStore((state) => state.setHoveredNavigationId);
	const isResizable = !isMobile && !isCollapsed && isVisible;

	const handlePointerOver = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (isResizing) return;
			const target = event.target instanceof Element ? event.target : null;
			const hoveredItem = target?.closest<HTMLElement>(`[${NAVIGATION_HOVER_ID_ATTR}]`);
			setHoveredNavigationId(hoveredItem?.getAttribute(NAVIGATION_HOVER_ID_ATTR) ?? "sidebar");
		},
		[isResizing, setHoveredNavigationId],
	);

	const handlePointerLeave = useCallback(() => {
		if (isResizing) return;
		setHoveredNavigationId(null);
	}, [isResizing, setHoveredNavigationId]);
	const handleResizeReset = useCallback(() => {
		setWidthVar(LEFT_NAV_DEFAULT_WIDTH);
		setLeftWidth(LEFT_NAV_DEFAULT_WIDTH);
	}, [setLeftWidth, setWidthVar]);

	return (
		<>
			{isCollapsed && (
				<div
					{...{ [SIDEBAR_TRIGGER_ATTR]: true }}
					className={cn(
						"fixed bottom-0 left-0 top-[var(--catalog-titlebar-offset,0rem)] w-[5px] cursor-ew-resize",
						NAV_Z_INDEX,
					)}
				/>
			)}
			<Sidebar
				className={cn(
					"group-data-[side=left]:border-none print:hidden contain-layout contain-style left-navigation-content",
					LEFT_NAV_CLASS,
					NAV_Z_INDEX,
					"p-0",
					"!transition-[left] !duration-300 !ease-out motion-reduce:!transition-none",
					isCollapsed
						? ["!top-[var(--catalog-titlebar-offset,0rem)]", FLOATING_PANEL]
						: [
								"h-full",
								"[&>[data-sidebar=sidebar]]:!pt-[var(--catalog-titlebar-offset,0rem)]",
								EDGE_TO_EDGE_PANEL,
							],
					isMobile
						? INITIAL_DESKTOP_POSITION
						: isVisible
							? "!left-0"
							: "!left-[calc(var(--sidebar-width)*-1)]",
					isResizing && "!transition-none",
				)}
				collapsible="offcanvas"
				onPointerLeave={handlePointerLeave}
				onPointerOver={handlePointerOver}
				onTransitionEnd={onTransitionEnd}
				ref={navigationRef}
				side="left"
				style={
					isCollapsed
						? {
								bottom: leftNavigationBottom ? COLLAPSED_PANEL_OFFSET : 0,
								height: "auto",
								marginTop: COLLAPSED_PANEL_OFFSET,
								padding: VIEWPORT_PADDING,
							}
						: undefined
				}
				variant="floating"
			>
				{leftNavigationTop && (
					// The mobile sidebar is a Sheet that drops the panel className, so it clears the
					// native titlebar through its own header instead.
					<SidebarHeader
						className={cn("gap-0 !p-0", isMobile && "!pt-[var(--catalog-titlebar-offset,0rem)]")}
					>
						{leftNavigationTop}
					</SidebarHeader>
				)}
				<SidebarContent className="min-h-0 [&>div:first-of-type]:flex-1">
					{leftNavigationContent}
					{!isMobile && !isCollapsed && (
						<div
							aria-hidden
							className={cn("shrink-0", leftNavigationBottom ? "h-[4.375rem]" : "h-2")}
							data-testid="left-navigation-bottom-scroll-space"
						/>
					)}
				</SidebarContent>
				{isMobile && leftNavigationBottom && (
					<SidebarFooter className="gap-0 p-0">{leftNavigationBottom}</SidebarFooter>
				)}
				{isCollapsed && (
					<Tooltip>
						<TooltipTrigger asChild>
							<SidebarRail style={COLLAPSED_RAIL_STYLE} />
						</TooltipTrigger>
						<TooltipContent focus="high" side="right">
							{t("left-navigation.expand")}
						</TooltipContent>
					</Tooltip>
				)}
			</Sidebar>
			{!isMobile && (
				<SidebarResizer
					enabled={isResizable}
					maxWidth={LEFT_NAV_MAX_WIDTH}
					minWidth={LEFT_NAV_MIN_WIDTH}
					onDoubleClick={handleResizeReset}
					onPointerEnter={() => setHoveredNavigationId("sidebar")}
					onPointerLeave={handlePointerLeave}
					onResize={previewWidth}
					onResizeStop={setLeftWidth}
					onResizingChange={setIsResizing}
					width={width}
					zIndex={NAV_Z_INDEX_VALUE}
				/>
			)}
			{!isMobile && leftNavigationBottom && (
				<LeftNavigationSlot containerRef={bottomRef}>{leftNavigationBottom}</LeftNavigationSlot>
			)}
		</>
	);
};

export default LeftNavigationLayout;
