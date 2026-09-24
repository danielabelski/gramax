import { cn } from "@core-ui/utils/cn";
import { FloatingPanelLayout } from "@ui-kit/FloatingPanel";
import type { CSSProperties, ReactNode } from "react";
import { VIEWPORT_PADDING } from "../../../ui-kit/lib/floating";
import { useObserveCatalogViewportWidth } from "./RightNavigation/catalogViewportWidthStore";
import {
	EXPANDED_RIGHT_NAVIGATION_CLASS_NAME,
	RIGHT_NAVIGATION_CONTAINER_WIDTH,
	RIGHT_NAVIGATION_PANEL_INSET,
} from "./RightNavigation/constants";
import { useSideZoneMaxWidth } from "./useSideZoneMaxWidth";

type CatalogViewportLayoutProps = {
	children: ReactNode;
	rightNavigation: ReactNode;
};

export const CatalogViewportLayout = ({ children, rightNavigation }: CatalogViewportLayoutProps) => {
	const { maxWidth: sideZoneMaxWidth, resizeBoundaryRef } = useSideZoneMaxWidth();
	const catalogViewportRef = useObserveCatalogViewportWidth();

	return (
		<div
			className="relative h-full min-h-0 min-w-0 flex-1 [container-name:catalog-layout] [container-type:inline-size]"
			style={
				{
					"--catalog-right-navigation-width": `${RIGHT_NAVIGATION_CONTAINER_WIDTH}px`,
				} as CSSProperties
			}
		>
			{/* At 1024 + LEFT_NAV_MAX_WIDTH (480), both navigation breakpoints always match.
			    Keep the query size stable here to avoid restyling the article on dock/undock. */}
			<div
				className="h-full min-h-0 min-w-0 w-full [container-name:catalog-viewport] [container-type:inline-size] [html[data-left-sidebar-pinned=true]_&]:w-[calc(100%_-_var(--left-nav-width))] [@container_catalog-layout_(min-width:_1504px)]:!w-full"
				ref={catalogViewportRef}
			>
				<div className="h-full min-h-0 min-w-0 w-full [html[data-left-sidebar-pinned=true]_&]:w-[calc(100%_+_var(--left-nav-width))] [@container_catalog-layout_(min-width:_1504px)]:!w-full">
					<FloatingPanelLayout
						contentClassName={cn(
							"catalog-viewport-content [&_.article-layout]:pl-0 [&_.article-layout]:pr-0",
							"lg:[html[data-left-sidebar-pinned=true]_&]:[&_.article-layout]:pl-[var(--left-nav-width)]",
							"[@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:[&_.article-layout]:pr-[var(--catalog-right-navigation-width)]",
							"[@container_catalog-viewport_(min-width:_1284px)]:[html[data-left-sidebar-pinned=false]_&]:[&_.article-layout]:px-[var(--catalog-right-navigation-width)]",
						)}
						rightDockedZoneClassName={EXPANDED_RIGHT_NAVIGATION_CLASS_NAME}
						rightDockedZoneInset={RIGHT_NAVIGATION_PANEL_INSET}
						rightDockedZoneMaxWidth={sideZoneMaxWidth}
						rightZoneUnderlay={rightNavigation}
					>
						{children}
					</FloatingPanelLayout>
				</div>
			</div>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-y-0 right-0"
				data-side-zone-resize-boundary
				ref={resizeBoundaryRef}
				style={{ left: `calc(var(--left-nav-width) + ${VIEWPORT_PADDING}px)` }}
			/>
		</div>
	);
};
