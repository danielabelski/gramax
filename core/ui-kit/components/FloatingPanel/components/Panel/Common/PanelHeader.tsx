import { cn } from "@core-ui/utils/cn";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import t from "@ext/localization/locale/translate";
import { FloatingIconButton } from "@ui-kit/FloatingPanel/components/FloatingIconButton";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { useState } from "react";
import { usePanelSlotRef } from "../../../hooks/usePanelSlotRef";
import type { PanelId } from "../../../types/FloatingPanelTypes";

export type PanelHeaderDragProps = {
	listeners: SyntheticListenerMap | undefined;
	attributes: DraggableAttributes;
	isDragging: boolean;
};

type PanelHeaderProps = {
	id: PanelId;
	title: string;
	onClose: () => void;
	drag?: PanelHeaderDragProps;
	action: React.ReactNode;
};

export const PanelHeader = ({ id, title, onClose, drag, action }: PanelHeaderProps) => {
	const [isPressed, setIsPressed] = useState(false);
	const actionsRef = usePanelSlotRef(id, "header");

	return (
		<div
			{...drag?.listeners}
			{...drag?.attributes}
			className={cn(
				"absolute left-0 right-0 top-0 z-10 flex select-none items-center justify-between gap-4 p-2 pl-4 pt-2 focus-visible:outline-none",
				drag?.isDragging || isPressed ? "cursor-grabbing" : "cursor-grab",
			)}
			onLostPointerCapture={() => setIsPressed(false)}
			onPointerCancel={() => setIsPressed(false)}
			onPointerDown={(e) => {
				setIsPressed(true);
				drag?.listeners?.onPointerDown?.(e);
			}}
			onPointerUp={() => setIsPressed(false)}
			style={{
				touchAction: "none",
			}}
		>
			<TextOverflowTooltip className="min-w-0 flex-1 text-base font-semibold">{title}</TextOverflowTooltip>
			<div className="flex shrink-0 flex-row items-center" onPointerDown={(e) => e.stopPropagation()}>
				<div className="flex flex-row items-center" ref={actionsRef} />
				{action}
				<FloatingIconButton
					aria-label={t("close")}
					className="stroke-[1.75px]"
					data-testid="floating-panel-close"
					icon="x"
					onClick={onClose}
					size="md"
				/>
			</div>
		</div>
	);
};
