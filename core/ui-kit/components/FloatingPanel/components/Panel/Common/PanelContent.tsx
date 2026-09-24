import { usePanelSlotRef } from "../../../hooks/usePanelSlotRef";
import type { PanelId } from "../../../types/FloatingPanelTypes";

export const PanelContent = ({ id }: { id: PanelId }) => {
	const contentRef = usePanelSlotRef(id, "content");

	return <div className="flex min-h-0 flex-1 flex-col" ref={contentRef} />;
};
