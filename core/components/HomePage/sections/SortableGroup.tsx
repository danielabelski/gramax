import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import t from "@ext/localization/locale/translate";
import { IconButton } from "@ui-kit/Button";
import { useState } from "react";
import { tv } from "tailwind-variants";
import type { SectionDragHandleProps, SortableGroupProps } from "./sectionTypes";

const dragHandleStyles = tv({
	base: "absolute top-0 p-1 -left-7 opacity-0 transition-opacity duration-[150ms] touch-none group-hover/section:opacity-50 hover:!opacity-100",
	variants: {
		isDragging: {
			true: "!cursor-grabbing",
			false: "!cursor-grab",
		},
	},
});

const SortableGroup = ({ id, scrollKey, children }: SortableGroupProps) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
	const [isRenaming, setIsRenaming] = useState(false);
	const style = {
		transform: isDragging ? undefined : CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.35 : 1,
	};
	const dragHandleProps: SectionDragHandleProps = {
		attributes: isRenaming ? undefined : attributes,
		listeners: isRenaming ? undefined : listeners,
		isDragging,
	};
	return (
		<div
			className="scroll-mt-[52px] relative group/section"
			data-group-key={scrollKey}
			ref={setNodeRef}
			style={style}
		>
			<IconButton
				className={dragHandleStyles({ isDragging })}
				{...(isRenaming ? {} : { ...attributes, ...listeners })}
				aria-label={t("drag-to-reorder-section")}
				icon="grip-vertical"
				size="sm"
				variant="text"
			/>
			{children({ isRenaming, onRenamingChange: setIsRenaming }, dragHandleProps)}
		</div>
	);
};

export default SortableGroup;
