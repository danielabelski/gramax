import type { PanelId } from "../../../types/FloatingPanelTypes";
import { PanelContent } from "./PanelContent";
import { PanelHeader, type PanelHeaderDragProps } from "./PanelHeader";

type PanelBodyProps = {
	id: PanelId;
	title: string;
	onClose: () => void;
	drag?: PanelHeaderDragProps;
	action: React.ReactNode;
};

export const PanelBody = ({ id, title, onClose, drag, action }: PanelBodyProps) => {
	return (
		<>
			<div className="h-[46px] shrink-0" />
			<PanelContent id={id} />
			<PanelHeader action={action} drag={drag} id={id} onClose={onClose} title={title} />
		</>
	);
};
