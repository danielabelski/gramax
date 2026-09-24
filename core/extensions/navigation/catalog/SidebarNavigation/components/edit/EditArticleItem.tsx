import { BeforeItemDropZone } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarDragnDrop/BeforeItemDropZone";
import {
	DraggableSideMenuItemContent,
	ItemDroppable,
} from "@ext/navigation/catalog/SidebarNavigation/components/SidebarDragnDrop/ItemDndBindings";
import { ItemDragInsertionLine } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarDragnDrop/ItemDragInsertionLine";
import { SidebarInsertionLine } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarInsertionLine/SidebarInsertionLine";
import { VerticalLineSegment } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarInsertionLine/VerticalLineSegment";
import type { useInsertionLineState } from "@ext/navigation/catalog/SidebarNavigation/hooks/useInsertionLineState";
import type { DragLineState, useItemDndState } from "@ext/navigation/catalog/SidebarNavigation/hooks/useItemDndState";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import type { MutableRefObject } from "react";

interface EditArticleItemProps {
	data: ItemLink;
	level: number;
	isNested: boolean;
	isSelected: boolean;
	isHighlighted: boolean;
	itemRef: MutableRefObject<HTMLDivElement>;
	dnd: ReturnType<typeof useItemDndState>;
	insertionLine: ReturnType<typeof useInsertionLineState>;
	dragLine: DragLineState;
	onSelect: () => void;
	onAddChild: () => void;
}

export const EditArticleItem = ({
	data,
	level,
	isNested,
	isSelected,
	isHighlighted,
	itemRef,
	dnd,
	insertionLine,
	dragLine,
	onSelect,
	onAddChild,
}: EditArticleItemProps) => {
	const { isDragging, dropMode, isDragLocked } = dnd;
	const { minDepth, maxDepth, handleAdd, handleParentHover, showsLine, isAnchor } = insertionLine;
	const { showsDragLine, isDragAnchor } = dragLine;

	return (
		<ItemDroppable id={data.ref.path} itemRef={itemRef}>
			<BeforeItemDropZone itemId={data.ref.path} />
			{(showsLine || (showsDragLine && level > 1)) && (
				<VerticalLineSegment className={isAnchor || isDragAnchor ? "bottom-[0.3125rem]" : undefined} />
			)}
			<DraggableSideMenuItemContent
				data={data}
				disabled={isDragLocked}
				id={data.ref.path}
				isCategory={false}
				isDragging={isDragging}
				isHighlighted={isHighlighted}
				isNested={isNested}
				isSelected={isSelected}
				level={level}
				onAddChild={onAddChild}
				onSelect={onSelect}
			/>
			<SidebarInsertionLine
				className="-bottom-[0.3125rem]"
				level={level}
				maxDepth={maxDepth}
				minDepth={minDepth}
				onAdd={handleAdd}
				onParentHover={handleParentHover}
			/>
			<ItemDragInsertionLine dropMode={dropMode} />
		</ItemDroppable>
	);
};
