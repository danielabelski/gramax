import { useRegisterPanel } from "../hooks/useRegisterPanel";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import type { PanelDefinition } from "../types/FloatingPanelTypes";
import { StablePanelPortal } from "./StablePanelPortal";

type FloatingPanelProps = PanelDefinition & {
	headerActions?: React.ReactNode;
	children: React.ReactNode;
};

export const FloatingPanel = ({
	id,
	title,
	icon,
	interactionDisabled,
	headerActions,
	children,
}: FloatingPanelProps) => {
	useRegisterPanel(id, title, icon, interactionDisabled);
	const content = useFloatingPanelStore((state) => state.slots[id]?.content);
	const header = useFloatingPanelStore((state) => state.slots[id]?.header);

	return (
		<>
			{headerActions && <StablePanelPortal target={header}>{headerActions}</StablePanelPortal>}
			<StablePanelPortal target={content}>{children}</StablePanelPortal>
		</>
	);
};
