import { useCallback } from "react";
import { PANEL_DEFAULT_HEIGHT, PANEL_DEFAULT_WIDTH } from "../../constants";
import { usePanelDrag } from "../../hooks/usePanelDrag";
import { useFloatingPanelStore } from "../../store/useFloatingPanelStore";
import type { PanelId, SideZoneSide } from "../../types/FloatingPanelTypes";
import { clampPosition } from "../../utils/clampPosition";
import { DockedPanelView } from "./Docked/DockedPanelView";
import { FloatingPanelView } from "./Floating/FloatingPanelView";

type PanelProps = {
	id: PanelId;
	onClose: () => void;
	presenceState: "open" | "closed";
};

export const Panel = ({ id, onClose, presenceState }: PanelProps) => {
	const title = useFloatingPanelStore((state) => state.panels[id].title);
	const position = useFloatingPanelStore((state) => state.panels[id].position);
	const zIndex = useFloatingPanelStore((state) => state.panels[id].zIndex);
	const dockedSide = useFloatingPanelStore((state) => state.panels[id].dockedSide);
	const isMaximized = useFloatingPanelStore((state) => state.panels[id].isMaximized);
	const interactionDisabled = useFloatingPanelStore((state) => state.panels[id].interactionDisabled);
	const animationOrigin = useFloatingPanelStore((state) => state.panels[id].animationOrigin);
	const bringToFront = useFloatingPanelStore((state) => state.bringToFront);
	const dockPanel = useFloatingPanelStore((state) => state.dockPanel);
	const undockPanel = useFloatingPanelStore((state) => state.undockPanel);
	const maximizePanel = useFloatingPanelStore((state) => state.maximizePanel);
	const restorePanel = useFloatingPanelStore((state) => state.restorePanel);
	const resetSizeAndPosition = useFloatingPanelStore((state) => state.resetSizeAndPosition);
	const drag = usePanelDrag(id);

	const handleActivate = useCallback(() => bringToFront(id), [bringToFront, id]);
	const handleDock = (side: SideZoneSide) => dockPanel(id, side);
	const handleUndock = () =>
		undockPanel(
			id,
			position ?? clampPosition({ x: 0, y: 0 }, { width: PANEL_DEFAULT_WIDTH, height: PANEL_DEFAULT_HEIGHT }),
		);
	const handleMaximize = () => maximizePanel(id);
	const handleRestore = () => restorePanel(id);
	const handleResetSize = () => resetSizeAndPosition(id);

	if (dockedSide) {
		return (
			<DockedPanelView
				drag={drag}
				id={id}
				interactionDisabled={interactionDisabled}
				onClose={onClose}
				onDragStart={handleActivate}
				onUndock={handleUndock}
				title={title}
				zIndex={zIndex}
			/>
		);
	}

	if (!position) return null;

	return (
		<FloatingPanelView
			animationOrigin={animationOrigin}
			drag={drag}
			id={id}
			interactionDisabled={interactionDisabled}
			isMaximized={isMaximized}
			onActivate={handleActivate}
			onClose={onClose}
			onDock={handleDock}
			onMaximize={handleMaximize}
			onResetSize={handleResetSize}
			onRestore={handleRestore}
			position={position}
			presenceState={presenceState}
			title={title}
			zIndex={zIndex}
		/>
	);
};
