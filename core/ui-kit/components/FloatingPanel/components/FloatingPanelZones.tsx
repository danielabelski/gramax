import { cn } from "@core-ui/utils/cn";
import { DndContext } from "@dnd-kit/core";
import { type CSSProperties, useLayoutEffect, useMemo, useRef } from "react";
import { SIDE_ZONE_DEFAULT_WIDTH } from "../constants";
import { useActiveDropSide } from "../hooks/useActiveDropSide";
import { useFloatingPanelDnd } from "../hooks/useFloatingPanelDnd";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import type { PanelId, PanelState } from "../types/FloatingPanelTypes";
import { FloatingPanelLayer } from "./FloatingPanelLayer";
import { PanelWindow } from "./PanelWindow";
import { SideZone } from "./Zone/SideZone";
import { SideZoneStack } from "./Zone/SideZoneStack";

const RIGHT_DOCKED_ZONE_DEFAULT_INSET = 60;

interface FloatingPanelZonesProps {
	children: React.ReactNode;
	rightZoneUnderlay?: React.ReactNode;
	rightZoneUnderlayWidth?: number | string;
	rightDockedZoneClassName?: string;
	rightDockedZoneInset?: number;
	rightDockedZoneMaxWidth?: number;
	reserveRightUnderlay?: boolean;
	contentClassName?: string;
}

type FloatingPanelDndLayerProps = Pick<
	FloatingPanelZonesProps,
	"rightDockedZoneClassName" | "rightDockedZoneInset" | "rightDockedZoneMaxWidth"
>;

const FloatingPanelDndContent = ({
	rightDockedZoneClassName,
	rightDockedZoneInset = RIGHT_DOCKED_ZONE_DEFAULT_INSET,
	rightDockedZoneMaxWidth,
}: FloatingPanelDndLayerProps) => {
	const panels = useFloatingPanelStore((state) => state.panels);
	const activeDropSide = useActiveDropSide();
	const setRightDockZoneAvailability = useFloatingPanelStore((state) => state.setRightDockZoneAvailability);
	const setRightDockZoneBounds = useFloatingPanelStore((state) => state.setRightDockZoneBounds);
	const rightDockZoneRef = useRef<HTMLDivElement>(null);

	const { rightDockedPanels, panelIds } = useMemo(() => {
		const rightDockedPanels: PanelState[] = [];
		const panelIds: PanelId[] = [];

		Object.keys(panels).forEach((panelId) => {
			const panel = panels[panelId];
			panelIds.push(panelId);
			if (!panel.isOpen) return;
			if (panel.dockedSide === "right") rightDockedPanels.push(panel);
		});

		return { rightDockedPanels, panelIds };
	}, [panels]);

	useLayoutEffect(() => {
		const dockZone = rightDockZoneRef.current;
		if (!dockZone) return;
		let updateFrame: number | null = null;

		const updateDockZone = () => {
			updateFrame = null;
			const { left, right, top, bottom, width, height } = dockZone.getBoundingClientRect();
			const isAvailable = width > 0 && height > 0;
			setRightDockZoneAvailability(isAvailable, {
				width: window.innerWidth,
				height: window.innerHeight,
			});
			setRightDockZoneBounds(isAvailable && rightDockedPanels.length > 0 ? { left, right, top, bottom } : null);
		};
		const scheduleDockZoneUpdate = () => {
			if (updateFrame !== null) return;
			updateFrame = requestAnimationFrame(updateDockZone);
		};

		updateDockZone();
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleDockZoneUpdate);
		observer?.observe(dockZone);
		window.addEventListener("resize", scheduleDockZoneUpdate);

		return () => {
			window.removeEventListener("resize", scheduleDockZoneUpdate);
			observer?.disconnect();
			if (updateFrame !== null) cancelAnimationFrame(updateFrame);
			setRightDockZoneBounds(null);
			setRightDockZoneAvailability(null, { width: window.innerWidth, height: window.innerHeight });
		};
	}, [rightDockedPanels.length, setRightDockZoneAvailability, setRightDockZoneBounds]);

	return (
		<>
			<FloatingPanelLayer>
				{panelIds.map((panelId) => (
					<PanelWindow id={panelId} key={panelId} />
				))}
			</FloatingPanelLayer>

			<SideZoneStack maxWidth={rightDockedZoneMaxWidth} side="right">
				<div
					className={cn("absolute inset-x-0", rightDockedZoneClassName ?? "hidden 2xl:block")}
					ref={rightDockZoneRef}
					style={{ bottom: rightDockedZoneInset, pointerEvents: "none", top: rightDockedZoneInset }}
				>
					<SideZone
						className="ml-0 my-0 h-full"
						isOver={activeDropSide === "right"}
						maxWidth={rightDockedZoneMaxWidth}
						panels={rightDockedPanels}
						side="right"
					/>
				</div>
			</SideZoneStack>
		</>
	);
};

const FloatingPanelDndLayer = (props: FloatingPanelDndLayerProps) => {
	const { handleDragStart, handleDragEnd, modifiers } = useFloatingPanelDnd();

	return (
		<DndContext modifiers={modifiers} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
			<FloatingPanelDndContent {...props} />
		</DndContext>
	);
};

export const FloatingPanelZones = ({
	children,
	rightZoneUnderlay,
	rightZoneUnderlayWidth = SIDE_ZONE_DEFAULT_WIDTH,
	rightDockedZoneClassName,
	rightDockedZoneInset = RIGHT_DOCKED_ZONE_DEFAULT_INSET,
	rightDockedZoneMaxWidth,
	reserveRightUnderlay = false,
	contentClassName,
}: FloatingPanelZonesProps) => {
	const resolvedRightZoneUnderlayWidth =
		typeof rightZoneUnderlayWidth === "number" ? `${rightZoneUnderlayWidth}px` : rightZoneUnderlayWidth;

	return (
		<>
			<div
				className={cn("h-full min-w-0 flex-1", contentClassName)}
				style={
					{
						"--right-zone-underlay-width": reserveRightUnderlay ? resolvedRightZoneUnderlayWidth : "0px",
					} as CSSProperties
				}
			>
				{children}
			</div>

			{rightZoneUnderlay && (
				<div
					className="pointer-events-none absolute inset-y-0 right-0 [&>*]:pointer-events-auto"
					data-floating-panel-underlay="right"
				>
					{rightZoneUnderlay}
				</div>
			)}

			<FloatingPanelDndLayer
				rightDockedZoneClassName={rightDockedZoneClassName}
				rightDockedZoneInset={rightDockedZoneInset}
				rightDockedZoneMaxWidth={rightDockedZoneMaxWidth}
			/>
		</>
	);
};
