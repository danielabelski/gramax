import { type DraggableAttributes, useDraggable } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { Transform } from "@dnd-kit/utilities";
import type { PanelId } from "../types/FloatingPanelTypes";

export type PanelDragState = {
	attributes: DraggableAttributes;
	listeners: SyntheticListenerMap | undefined;
	setNodeRef: (node: HTMLElement | null) => void;
	transform: Transform | null;
	isDragging: boolean;
	dockedDragRect: { left: number; top: number; width: number; height: number } | null | undefined;
};

export const usePanelDrag = (id: PanelId): PanelDragState => {
	const { attributes, listeners, setNodeRef, transform, isDragging, active } = useDraggable({ id });
	const dockedDragRect = isDragging ? active?.rect.current.initial : null;

	return { attributes, listeners, setNodeRef, transform, isDragging, dockedDragRect };
};
