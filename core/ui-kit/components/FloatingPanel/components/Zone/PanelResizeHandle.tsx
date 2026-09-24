import { cn } from "@core-ui/utils/cn";
import { ResizableHandlePrimitive } from "ics-ui-kit/components/resizable";
import { useFloatingPanelStore } from "../../store/useFloatingPanelStore";

export const PanelResizeHandle = () => {
	const setIsResizingDockedPanels = useFloatingPanelStore((state) => state.setIsResizingDockedPanels);

	return (
		<ResizableHandlePrimitive
			className="group relative flex shrink-0 basis-2 items-center justify-center"
			onDragging={setIsResizingDockedPanels}
		>
			<div
				className={cn(
					"h-1 w-8 rounded-full bg-transparent transition-colors group-hover:bg-muted group-data-[resize-handle-active]:bg-muted",
				)}
			/>
		</ResizableHandlePrimitive>
	);
};
