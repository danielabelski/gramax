import { cn } from "@core-ui/utils/cn";
import { NavigationCollapseChevron } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/NavigationCollapseChevron";
import { BeforeItemDropZone } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarDragnDrop/BeforeItemDropZone";
import {
	DraggableSideMenuItemContent,
	ItemDroppable,
} from "@ext/navigation/catalog/SidebarNavigation/components/SidebarDragnDrop/ItemDndBindings";
import { ItemDragInsertionLine } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarDragnDrop/ItemDragInsertionLine";
import { SidebarInsertionLine } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarInsertionLine/SidebarInsertionLine";
import { VerticalLineSegment } from "@ext/navigation/catalog/SidebarNavigation/components/SidebarInsertionLine/VerticalLineSegment";
import { useCollapsibleAnimation } from "@ext/navigation/catalog/SidebarNavigation/hooks/useCollapsibleAnimation";
import type { useInsertionLineState } from "@ext/navigation/catalog/SidebarNavigation/hooks/useInsertionLineState";
import type { DragLineState, useItemDndState } from "@ext/navigation/catalog/SidebarNavigation/hooks/useItemDndState";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { Collapsible, CollapsibleContent } from "@ui-kit/Collapsible";
import { SidebarMenuSub } from "@ui-kit/Sidebar";
import type { MutableRefObject, ReactNode } from "react";

interface EditFolderItemProps {
	data: ItemLink;
	level: number;
	open: boolean;
	isNested: boolean;
	isSelected: boolean;
	isHighlighted: boolean;
	children: ReactNode;
	virtualized?: boolean;
	itemRef: MutableRefObject<HTMLDivElement>;
	dnd: ReturnType<typeof useItemDndState>;
	insertionLine: ReturnType<typeof useInsertionLineState>;
	dragLine: DragLineState;
	onToggle: (next: boolean) => void;
	onSelect: () => void;
	onAddChild: () => void;
}

export const EditFolderItem = ({
	data,
	level,
	open,
	isNested,
	isSelected,
	isHighlighted,
	children,
	virtualized = false,
	itemRef,
	dnd,
	insertionLine,
	dragLine,
	onToggle,
	onSelect,
	onAddChild,
}: EditFolderItemProps) => {
	const { animating, handleOpenChange, handleAnimationEnd } = useCollapsibleAnimation(onToggle);

	const { isDragging, dropMode, isDragLocked } = dnd;
	const { minDepth, maxDepth, handleAdd, handleParentHover, showsLine, isAnchor } = insertionLine;
	const { showsDragLine, isDragAnchor } = dragLine;

	return (
		<Collapsible
			className={cn("relative flex flex-col gap-0.5", isDragging && "opacity-50")}
			onOpenChange={virtualized ? onToggle : handleOpenChange}
			open={open}
			ref={itemRef}
		>
			<BeforeItemDropZone itemId={data.ref.path} />
			{(showsLine || (showsDragLine && !isDragAnchor && level > 1)) && (
				<VerticalLineSegment className={isAnchor ? "bottom-[0.3125rem]" : undefined} />
			)}
			<ItemDroppable id={data.ref.path}>
				{showsDragLine && isDragAnchor && level > 1 && <VerticalLineSegment className="bottom-[0.3125rem]" />}
				<DraggableSideMenuItemContent
					data={data}
					disabled={isDragLocked}
					id={data.ref.path}
					isCategory
					isHighlighted={isHighlighted}
					isNested={isNested}
					isSelected={isSelected}
					level={level}
					onAddChild={onAddChild}
					onSelect={onSelect}
					trigger={<NavigationCollapseChevron open={open} />}
				/>
				<SidebarInsertionLine
					className="-bottom-[0.3125rem]"
					level={level}
					maxDepth={maxDepth}
					minDepth={minDepth}
					onAdd={handleAdd}
					onParentHover={handleParentHover}
				/>
				<ItemDragInsertionLine dropMode={dropMode} isOpen={open} />
			</ItemDroppable>
			{!virtualized && (
				<CollapsibleContent
					className={cn(!animating && "data-[state=open]:!overflow-visible")}
					onAnimationEnd={handleAnimationEnd}
				>
					<div className="relative ml-4">
						<SidebarMenuSub className="ml-0 gap-0 border-none p-0 [&>*:not(:first-child)]:pt-0.5">
							{children}
						</SidebarMenuSub>
					</div>
				</CollapsibleContent>
			)}
		</Collapsible>
	);
};
