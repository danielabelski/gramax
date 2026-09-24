import { PANEL_EXIT_ANIMATION_DURATION } from "../constants";
import { useDelayedPresence } from "../hooks/useDelayedPresence";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import type { PanelId } from "../types/FloatingPanelTypes";
import { Panel } from "./Panel/Panel";

export const PanelWindow = ({ id }: { id: PanelId }) => {
	const isOpen = useFloatingPanelStore((state) => state.panels[id]?.isOpen);
	const dockedSide = useFloatingPanelStore((state) => state.panels[id]?.dockedSide);
	const setIsOpen = useFloatingPanelStore((state) => state.setIsOpen);
	const isPresent = useDelayedPresence(isOpen, PANEL_EXIT_ANIMATION_DURATION);

	if (!isPresent || dockedSide) return null;

	return <Panel id={id} onClose={() => setIsOpen(id, false)} presenceState={isOpen ? "open" : "closed"} />;
};
