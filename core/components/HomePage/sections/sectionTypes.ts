import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { ComponentType, ReactNode } from "react";

export interface RenameState {
	isRenaming: boolean;
	onRenamingChange: (isRenaming: boolean) => void;
}

/**
 * What a section lets you do with itself while the layout is being edited. Either a section is editable and has all
 * four, or it is not editable at all and has none — the uncategorized one, and every section outside edit mode.
 * Folder actions are not here: those work in the uncategorized section too, so they live in `HomeGroupContext`.
 */
export interface SectionEditActions {
	onTitleChange: (title: string) => void;
	onConvertToFolder: () => void;
	convertToFolderDisabled: boolean;
	onDelete: () => void;
}

/** dnd-kit types only, erased at compile time — importing them keeps this module free of the dnd-kit bundle. */
export interface SectionDragHandleProps {
	attributes: DraggableAttributes;
	listeners: DraggableSyntheticListeners;
	isDragging: boolean;
}

export interface SortableGroupProps {
	id: string;
	scrollKey: string;
	children: (renameState: RenameState, dragHandleProps: SectionDragHandleProps) => ReactNode;
}

export type SortableGroupComponent = ComponentType<SortableGroupProps>;
