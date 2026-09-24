import { cn } from "@core-ui/utils/cn";
import { type CollisionDetection, closestCenter, pointerWithin, useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, type SortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import t from "@ext/localization/locale/translate";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { type Dispatch, type SetStateAction, useCallback } from "react";
import { tv } from "tailwind-variants";
import Card from "../Card";
import { cardId } from "../dnd/ids";

export const FOLDER_BACK_ZONE_ID = "folder-back-zone";

const draggableCatalogStyles = tv({
	slots: {
		wrapper: "touch-none",
		card: "",
	},
	variants: {
		isDragging: {
			true: { wrapper: "!cursor-grabbing", card: "!cursor-grabbing" },
			false: { wrapper: "!cursor-grab", card: "!cursor-grab" },
		},
	},
});

export const folderDragCollisionDetection: CollisionDetection = (args) => {
	const zoneContainer = args.droppableContainers.filter((c) => c.id === FOLDER_BACK_ZONE_ID);
	const zoneHit = pointerWithin({ ...args, droppableContainers: zoneContainer });
	if (zoneHit.length > 0) return zoneHit;

	const cardContainers = args.droppableContainers.filter((c) => c.id !== FOLDER_BACK_ZONE_ID);
	return closestCenter({ ...args, droppableContainers: cardContainers });
};

export const folderSortingStrategy: SortingStrategy = (args) => (args.overIndex < 0 ? null : rectSortingStrategy(args));

interface DraggableFolderCatalogProps {
	link: CatalogLink;
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
}

export const DraggableFolderCatalog = ({ link, setIsAnyCardLoading }: DraggableFolderCatalogProps) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: cardId(link.name),
	});
	const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
	const { wrapper, card } = draggableCatalogStyles({ isDragging });
	const handleClick = useCallback(() => setIsAnyCardLoading(true), [setIsAnyCardLoading]);
	return (
		<div
			className={wrapper()}
			onDragStartCapture={(e) => e.preventDefault()}
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
		>
			<div style={{ pointerEvents: "none" }}>
				<Card className={card()} link={link} name={link.name} onClick={handleClick} />
			</div>
		</div>
	);
};

export const FolderBackDropZone = () => {
	const { setNodeRef, isOver } = useDroppable({ id: FOLDER_BACK_ZONE_ID });
	return (
		<div
			className={cn(
				"relative flex h-[132px] flex-col items-center justify-center rounded-xl border border-dashed border-primary-border p-6 transition-colors",
				isOver && "bg-secondary-bg-hover",
			)}
			ref={setNodeRef}
		>
			<p className="flex flex-wrap justify-center gap-1 text-center text-xs text-muted">
				{t("drop-to-uncategorize-hint")}
			</p>
		</div>
	);
};
