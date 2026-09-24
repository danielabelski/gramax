import { Resizable } from "re-resizable";
import type { CSSProperties, MouseEventHandler, PointerEventHandler } from "react";

const HANDLE_WIDTH = 6;

const HANDLE_CLASS = "group flex items-center justify-center";

type SidebarResizerProps = {
	enabled?: boolean;
	width: number;
	minWidth: number;
	maxWidth: number;
	onResize: (width: number) => void;
	onResizeStop: (width: number) => void;
	onResizingChange?: (isResizing: boolean) => void;
	onDoubleClick?: MouseEventHandler<HTMLDivElement>;
	onPointerEnter?: PointerEventHandler<HTMLDivElement>;
	onPointerLeave?: PointerEventHandler<HTMLDivElement>;
	handleOffset?: number;
	zIndex?: CSSProperties["zIndex"];
};

export const SidebarResizer = ({
	enabled = true,
	width,
	minWidth,
	maxWidth,
	onResize,
	onResizeStop,
	onResizingChange,
	onDoubleClick,
	onPointerEnter,
	onPointerLeave,
	handleOffset = 0,
	zIndex,
}: SidebarResizerProps) => (
	// re-resizable mutates and measures its parent on every move; keep that parent out of the article layout.
	<div
		style={{
			position: "fixed",
			top: 0,
			left: 0,
			width: "100%",
			height: "100%",
			contain: "layout",
			zIndex,
			pointerEvents: "none",
		}}
	>
		<Resizable
			{...{ onDoubleClick, onPointerEnter, onPointerLeave }}
			enable={{ right: enabled }}
			handleClasses={{ right: HANDLE_CLASS }}
			handleStyles={{
				right: {
					width: HANDLE_WIDTH,
					right: handleOffset,
					cursor: "ew-resize",
					pointerEvents: "auto",
					zIndex: 20,
				},
			}}
			maxWidth={maxWidth}
			minWidth={minWidth}
			onResize={(_event, _direction, element) => onResize(element.offsetWidth)}
			onResizeStart={(event) => {
				event.preventDefault();
				onResizingChange?.(true);
			}}
			onResizeStop={(_event, _direction, element) => {
				onResizingChange?.(false);
				onResizeStop(element.offsetWidth);
			}}
			size={{ width, height: "100%" }}
			style={{ position: "fixed", top: 0, left: 0, zIndex, pointerEvents: "none" }}
		/>
	</div>
);
