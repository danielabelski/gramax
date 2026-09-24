import type { NumberSize, Resizable, ResizeDirection, ResizeStartCallback } from "re-resizable";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import type { PanelId, Position } from "../types/FloatingPanelTypes";
import { getResizedPanelPosition } from "../utils/getResizedPanelPosition";

export const usePanelResize = (
	id: PanelId,
	position: Position | null,
	setDragNodeRef: (node: HTMLElement | null) => void,
) => {
	const size = useFloatingPanelStore((state) => state.panels[id].size);
	const setSizeAndPosition = useFloatingPanelStore((state) => state.setSizeAndPosition);

	const [resizePosition, setResizePosition] = useState<Position | null>(null);
	const [isResizing, setIsResizing] = useState(false);
	const resizeStartPositionRef = useRef(position);
	const resizeDeltaRef = useRef<NumberSize>({ width: 0, height: 0 });
	const resizableInstanceRef = useRef<Resizable | null>(null);

	const livePosition = isResizing ? (resizePosition ?? position) : position;

	const resizableRef = useCallback(
		(resizable: Resizable | null) => {
			resizableInstanceRef.current = resizable;
			setDragNodeRef(resizable?.resizable ?? null);
		},
		[setDragNodeRef],
	);

	useEffect(() => {
		if (isResizing) return;
		resizableInstanceRef.current?.updateSize(size);
	}, [isResizing, size]);

	const getAdjustedPosition = useCallback(
		(direction: ResizeDirection, delta: NumberSize): Position | null =>
			getResizedPanelPosition({
				start: resizeStartPositionRef.current,
				direction,
				delta,
				panelSize: size,
			}),
		[size],
	);

	const handleResizeStart = useCallback<ResizeStartCallback>(
		(event) => {
			event.preventDefault();
			resizeStartPositionRef.current = position;
			resizeDeltaRef.current = { width: 0, height: 0 };
			setResizePosition(position);
			setIsResizing(true);
		},
		[position],
	);

	const handleResize = useCallback(
		(_event: unknown, direction: ResizeDirection, _ref: unknown, delta: NumberSize) => {
			resizeDeltaRef.current = delta;
			const adjustedPosition = getAdjustedPosition(direction, delta);
			if (adjustedPosition) setResizePosition(adjustedPosition);
		},
		[getAdjustedPosition],
	);

	const handleResizeStop = useCallback(
		(_event: unknown, direction: ResizeDirection) => {
			const delta = resizeDeltaRef.current;
			const adjustedPosition = getAdjustedPosition(direction, delta);
			setIsResizing(false);
			setResizePosition(null);
			if (!adjustedPosition) return;
			setSizeAndPosition(
				id,
				{ width: size.width + delta.width, height: size.height + delta.height },
				adjustedPosition,
			);
		},
		[id, setSizeAndPosition, size.height, size.width, getAdjustedPosition],
	);

	return { size, livePosition, isResizing, resizableRef, handleResizeStart, handleResize, handleResizeStop };
};
