import { CSS } from "@dnd-kit/utilities";
import { cn } from "ics-ui-kit/lib/utils";
import type { PanelDragState } from "../../../hooks/usePanelDrag";
import type { PanelId } from "../../../types/FloatingPanelTypes";
import { PanelBody } from "../Common/PanelBody";
import { DockedAction } from "./DockedAction";

type DockedPanelViewProps = {
	id: PanelId;
	interactionDisabled?: boolean;
	title: string;
	zIndex: number;
	drag: PanelDragState;
	onDragStart: () => void;
	onClose: () => void;
	onUndock: () => void;
};

export const DockedPanelView = ({
	id,
	interactionDisabled,
	title,
	zIndex,
	drag,
	onDragStart,
	onClose,
	onUndock,
}: DockedPanelViewProps) => {
	const { attributes, listeners, setNodeRef, transform, isDragging, dockedDragRect } = drag;
	const isFloatingWhileDragging = isDragging && dockedDragRect;

	return (
		<>
			<div
				aria-label={title}
				className={cn(
					"backdrop-glass-regular flex flex-col overflow-hidden rounded-2xl border border-transparent bg-alpha-40 shadow-glass-lg",
					interactionDisabled && "pointer-events-none [&_*]:!pointer-events-none",
					isFloatingWhileDragging ? "bg-alpha-40" : "relative h-full w-full",
				)}
				data-floating-panel-id={id}
				onMouseDown={onDragStart}
				ref={setNodeRef}
				role="dialog"
				style={
					isFloatingWhileDragging
						? {
								position: "fixed",
								left: dockedDragRect.left,
								top: dockedDragRect.top,
								width: dockedDragRect.width,
								height: dockedDragRect.height,
								zIndex,
								transform: CSS.Translate.toString(transform),
							}
						: undefined
				}
			>
				<PanelBody
					action={<DockedAction onUndock={onUndock} />}
					drag={{ listeners, attributes, isDragging }}
					id={id}
					onClose={onClose}
					title={title}
				/>
			</div>
		</>
	);
};
