import { type RefObject, useCallback, useEffect, useRef } from "react";
import { PANEL_GAP } from "../constants";
import { getPanelTriggers, registerPanelTrigger, unregisterPanelTrigger } from "../registry/panelTriggerRegistry";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import type { PanelAnimationOrigin, PanelId, Position } from "../types/FloatingPanelTypes";
import { getPanelPositionByTrigger } from "../utils/getPanelPositionByTrigger";

type OpenPanelPlacement = {
	position: Position;
	animationOrigin?: PanelAnimationOrigin;
};

export const usePanelToggle = (id: PanelId, triggerRef?: RefObject<HTMLElement | null>) => {
	const isOpen = useFloatingPanelStore((state) => state.panels[id]?.isOpen ?? false);
	const isUserPositioned = useFloatingPanelStore((state) => state.panels[id]?.isUserPositioned ?? false);
	const size = useFloatingPanelStore((state) => state.panels[id]?.size);
	const setTransientPosition = useFloatingPanelStore((state) => state.setTransientPosition);
	const setIsOpen = useFloatingPanelStore((state) => state.setIsOpen);
	const positionFrameRef = useRef<number | null>(null);

	const updatePositionFromTrigger = useCallback(() => {
		if (isUserPositioned || !size) return;
		const triggerElement = [triggerRef?.current, ...getPanelTriggers(id)].find((element) => {
			if (!element?.isConnected) return false;
			const rect = element.getBoundingClientRect();
			return (
				rect.right > rect.left &&
				rect.bottom > rect.top &&
				rect.right > 0 &&
				rect.bottom > 0 &&
				rect.left < window.innerWidth &&
				rect.top < window.innerHeight
			);
		});
		if (triggerElement) {
			const trigger = triggerElement.getBoundingClientRect();
			const placement = getPanelPositionByTrigger({
				trigger,
				panelSize: size,
				viewport: { width: window.innerWidth, height: window.innerHeight },
				gap: PANEL_GAP,
			});
			setTransientPosition(id, placement.position, placement.animationOrigin);
			return;
		}
		setTransientPosition(id, {
			x: Math.max(0, (window.innerWidth - size.width) / 2),
			y: Math.max(0, (window.innerHeight - size.height) / 2),
		});
	}, [id, isUserPositioned, setTransientPosition, size, triggerRef]);
	const schedulePositionUpdate = useCallback(() => {
		if (positionFrameRef.current !== null) return;
		positionFrameRef.current = window.requestAnimationFrame(() => {
			positionFrameRef.current = null;
			updatePositionFromTrigger();
		});
	}, [updatePositionFromTrigger]);

	useEffect(() => {
		const trigger = triggerRef?.current;
		if (!trigger) return;
		registerPanelTrigger(id, trigger);
		return () => unregisterPanelTrigger(id, trigger);
	}, [id, triggerRef]);

	useEffect(() => {
		if (!isOpen || isUserPositioned) return;
		schedulePositionUpdate();
		window.addEventListener("resize", schedulePositionUpdate);
		window.addEventListener("scroll", schedulePositionUpdate, true);
		return () => {
			window.removeEventListener("resize", schedulePositionUpdate);
			window.removeEventListener("scroll", schedulePositionUpdate, true);
			if (positionFrameRef.current !== null) {
				window.cancelAnimationFrame(positionFrameRef.current);
				positionFrameRef.current = null;
			}
		};
	}, [isOpen, isUserPositioned, schedulePositionUpdate]);

	const open = useCallback(
		(placement?: OpenPanelPlacement) => {
			if (placement) setTransientPosition(id, placement.position, placement.animationOrigin);
			else updatePositionFromTrigger();
			setIsOpen(id, true);
		},
		[id, setIsOpen, setTransientPosition, updatePositionFromTrigger],
	);

	const close = useCallback(() => setIsOpen(id, false), [id, setIsOpen]);
	const toggle = useCallback(() => (isOpen ? close() : open()), [close, isOpen, open]);

	return { isOpen, open, close, toggle };
};
