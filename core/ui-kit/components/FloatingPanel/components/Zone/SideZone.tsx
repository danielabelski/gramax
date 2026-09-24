import { ResizablePanel, ResizablePanelGroup } from "ics-ui-kit/components/resizable";
import { cn } from "ics-ui-kit/lib/utils";
import { Resizable } from "re-resizable";
import { Fragment, type MouseEvent, useLayoutEffect, useRef } from "react";
import { VIEWPORT_PADDING } from "../../../../lib/floating";
import { SIDE_ZONE_DEFAULT_WIDTH, SIDE_ZONE_MIN_WIDTH, SIDE_ZONE_PANEL_MIN_SIZE } from "../../constants";
import { useFloatingPanelStore } from "../../store/useFloatingPanelStore";
import type { PanelState, SideZoneSide } from "../../types/FloatingPanelTypes";
import { Panel } from "../Panel/Panel";
import { PanelResizeHandle } from "./PanelResizeHandle";

type SideZoneProps = {
	side: SideZoneSide;
	panels: PanelState[];
	isOver: boolean;
	maxWidth?: number;
	className?: string;
};

export const SideZone = ({ side, panels, isOver, maxWidth, className }: SideZoneProps) => {
	const width = useFloatingPanelStore((state) => state.sideZoneWidths[side]);
	const setSideZoneWidth = useFloatingPanelStore((state) => state.setSideZoneWidth);
	const setIsOpen = useFloatingPanelStore((state) => state.setIsOpen);
	const effectiveWidth = maxWidth === undefined ? width : Math.min(width, maxWidth);
	const widthBeforeResizeRef = useRef(effectiveWidth);

	useLayoutEffect(() => {
		if (maxWidth === undefined || width <= maxWidth) return;
		setSideZoneWidth(side, maxWidth);
	}, [maxWidth, setSideZoneWidth, side, width]);

	const handleResize = (delta: number) => setSideZoneWidth(side, widthBeforeResizeRef.current + delta);
	const handleResizeMouseDown = (event: MouseEvent<HTMLDivElement>) => {
		if (event.detail !== 2) return;
		event.stopPropagation();
		setSideZoneWidth(side, SIDE_ZONE_DEFAULT_WIDTH);
	};
	const resizeHandle = <div className="size-full" onMouseDown={handleResizeMouseDown} />;

	return (
		<Resizable
			enable={{ left: true }}
			handleComponent={{
				left: resizeHandle,
			}}
			maxWidth={maxWidth ?? "100vw"}
			minWidth={SIDE_ZONE_MIN_WIDTH}
			onResize={(_event, _direction, _ref, delta) => handleResize(delta.width)}
			onResizeStart={() => {
				widthBeforeResizeRef.current = effectiveWidth;
			}}
			size={{ width: effectiveWidth, height: "100%" }}
			style={{ pointerEvents: panels.length === 0 ? "none" : "auto" }}
		>
			<div
				className={cn(
					"relative h-[calc(100%-1rem)] rounded-2xl border border-transparent transition-colors",
					isOver && "border-dashed border-muted",
					className,
				)}
				style={{ marginRight: VIEWPORT_PADDING }}
			>
				{isOver && <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl bg-alpha-high-90" />}
				<ResizablePanelGroup
					autoSaveId={`side-zone-${side}`}
					direction="vertical"
					style={{ overflow: "visible" }}
				>
					{panels.map(({ id }, index) => (
						<Fragment key={id}>
							{index > 0 && <PanelResizeHandle />}
							<ResizablePanel
								id={id}
								minSize={SIDE_ZONE_PANEL_MIN_SIZE}
								order={index}
								style={{ overflow: "visible", minHeight: 0 }}
							>
								<Panel id={id} onClose={() => setIsOpen(id, false)} presenceState="open" />
							</ResizablePanel>
						</Fragment>
					))}
				</ResizablePanelGroup>
			</div>
		</Resizable>
	);
};
