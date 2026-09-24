import { CSS } from "@dnd-kit/utilities";
import { ResizableCornerIcon } from "ics-ui-kit/components/resizable";
import { cn } from "ics-ui-kit/lib/utils";
import { Resizable } from "re-resizable";
import { MAXIMIZED_PANEL_Z_INDEX, PANEL_MAX_WIDTH, PANEL_MIN_HEIGHT, PANEL_MIN_WIDTH } from "../../../constants";
import { usePanelActivation } from "../../../hooks/usePanelActivation";
import type { PanelDragState } from "../../../hooks/usePanelDrag";
import { usePanelResize } from "../../../hooks/usePanelResize";
import type { PanelAnimationOrigin, PanelId, Position, SideZoneSide } from "../../../types/FloatingPanelTypes";
import { getFloatingPanelAnimationClassName } from "../../../utils/getFloatingPanelAnimationClassName";
import { PanelBody } from "../Common/PanelBody";
import { FloatingAction } from "./FloatingAction";

type FloatingPanelViewProps = {
	id: PanelId;
	interactionDisabled?: boolean;
	title: string;
	position: Position;
	zIndex: number;
	isMaximized: boolean;
	animationOrigin: PanelAnimationOrigin;
	presenceState: "open" | "closed";
	drag: PanelDragState;
	onActivate: () => void;
	onClose: () => void;
	onDock: (side: SideZoneSide) => void;
	onMaximize: () => void;
	onRestore: () => void;
	onResetSize: () => void;
};

export const FloatingPanelView = ({
	id,
	interactionDisabled,
	title,
	position,
	zIndex,
	isMaximized,
	animationOrigin,
	presenceState,
	drag,
	onActivate,
	onClose,
	onDock,
	onMaximize,
	onRestore,
	onResetSize,
}: FloatingPanelViewProps) => {
	const { attributes, listeners, setNodeRef, transform, isDragging } = drag;
	const activationRef = usePanelActivation(isMaximized || interactionDisabled ? undefined : onActivate, setNodeRef);
	const { size, livePosition, resizableRef, handleResizeStart, handleResize, handleResizeStop } = usePanelResize(
		id,
		position,
		activationRef,
	);

	if (!livePosition) return null;

	return (
		<Resizable
			className={cn(
				"backdrop-glass-regular flex flex-col rounded-2xl bg-alpha-40 shadow-glass-md will-change-[opacity,transform]",
				interactionDisabled && "pointer-events-none [&_*]:!pointer-events-none",
				`origin-${animationOrigin}`,
				getFloatingPanelAnimationClassName(presenceState, animationOrigin),
				"motion-reduce:animate-none",
				isMaximized && "rounded-none",
			)}
			data-floating-panel-id={id}
			defaultSize={size}
			enable={isMaximized ? false : undefined}
			handleComponent={{
				bottomRight: <ResizableCornerIcon className="absolute bottom-[11px] right-[11px]" />,
			}}
			handleStyles={{
				top: { zIndex: 20 },
				topLeft: { zIndex: 20, cursor: "nwse-resize" },
				topRight: { zIndex: 20, cursor: "nesw-resize" },
				bottomRight: { zIndex: 20, cursor: "nwse-resize" },
				bottomLeft: { cursor: "nesw-resize" },
			}}
			maxHeight={isMaximized ? undefined : window.innerHeight - livePosition.y}
			maxWidth={isMaximized ? undefined : PANEL_MAX_WIDTH}
			minHeight={PANEL_MIN_HEIGHT}
			minWidth={PANEL_MIN_WIDTH}
			onResize={handleResize}
			onResizeStart={handleResizeStart}
			onResizeStop={handleResizeStop}
			ref={resizableRef}
			size={isMaximized ? { width: "100%", height: "100%" } : undefined}
			style={
				isMaximized
					? { position: "fixed", inset: 0, zIndex: MAXIMIZED_PANEL_Z_INDEX }
					: {
							position: "fixed",
							left: livePosition.x,
							top: livePosition.y,
							zIndex,
							transform: CSS.Translate.toString(transform),
						}
			}
		>
			<div
				aria-label={title}
				className={cn(
					"absolute inset-0 flex flex-col overflow-hidden",
					isMaximized ? "rounded-none" : "rounded-2xl",
				)}
				role="dialog"
			>
				<PanelBody
					action={
						<FloatingAction
							isMaximized={isMaximized}
							onDock={onDock}
							onMaximize={onMaximize}
							onResetSize={onResetSize}
							onRestore={onRestore}
						/>
					}
					drag={isMaximized ? undefined : { listeners, attributes, isDragging }}
					id={id}
					onClose={onClose}
					title={title}
				/>
			</div>
		</Resizable>
	);
};
