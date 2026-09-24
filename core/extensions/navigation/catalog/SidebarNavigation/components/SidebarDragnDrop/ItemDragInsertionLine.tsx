import { DragInsertionLine } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarDragnDrop/DragInsertionLine";
import { DropMode } from "@ext/navigation/catalog/SidebarNavigation/utils/dropMode";

interface ItemDragInsertionLineProps {
	dropMode: DropMode | false | undefined;
	/** Whether the row has its children on screen right below it. */
	isOpen?: boolean;
}

/**
 * The drag line a row draws for its own drop mode. Folders and articles render it through here so the two can
 * not drift apart: the same mode has to look the same wherever it lands.
 *
 * The one row that draws less is an open container. Its `into` line would land between its own row and its
 * first child — a spot that already belongs to that child's `before`. The row highlight says "into" there.
 */
export const ItemDragInsertionLine = ({ dropMode, isOpen }: ItemDragInsertionLineProps) => {
	if (!dropMode) return null;
	if (dropMode === DropMode.Into && isOpen) return null;

	return (
		<DragInsertionLine
			className={dropMode === DropMode.Into ? "left-6" : undefined}
			position={dropMode === DropMode.Before ? "top" : undefined}
		/>
	);
};
