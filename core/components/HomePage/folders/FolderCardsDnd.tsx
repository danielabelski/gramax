import { DndContext, type DragEndEvent, type DragOverEvent, DragOverlay, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext } from "@dnd-kit/sortable";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CARD_ID_PREFIX, cardId } from "../dnd/ids";
import { cardDropAnimation, useHomeDndSensors } from "../dnd/sensors";
import { CardOverlay } from "../overlays";
import {
	DraggableFolderCatalog,
	FOLDER_BACK_ZONE_ID,
	FolderBackDropZone,
	folderDragCollisionDetection,
	folderSortingStrategy,
} from "./folderDnd";

interface FolderCardsDndProps {
	items: string[];
	linkByName: Record<string, CatalogLink>;
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
	onReorder?: (newOrder: string[]) => void;
	onRemoveFromFolder?: (catalogName: string) => void;
}

/** The edit-mode half of `FolderCardsGrid`, and the only place a folder page reaches dnd-kit. Loaded lazily. */
const FolderCardsDnd = ({
	items,
	linkByName,
	setIsAnyCardLoading,
	onReorder,
	onRemoveFromFolder,
}: FolderCardsDndProps) => {
	const [activeCardName, setActiveCardName] = useState<string | null>(null);
	const [dndItems, setDndItems] = useState(items);
	const dndItemsRef = useRef(dndItems);
	const sensors = useHomeDndSensors();

	const applyDnd = useCallback((next: string[]) => {
		if (next === dndItemsRef.current) return;
		dndItemsRef.current = next;
		setDndItems(next);
	}, []);

	const catalogLinks = useMemo(
		() => dndItems.map((name) => linkByName[name]).filter((l): l is CatalogLink => Boolean(l)),
		[dndItems, linkByName],
	);
	const sortableIds = useMemo(() => catalogLinks.map((l) => cardId(l.name)), [catalogLinks]);

	useEffect(() => {
		if (!activeCardName) applyDnd(items);
	}, [activeCardName, applyDnd, items]);

	const handleDragStart = useCallback((event: DragStartEvent) => {
		const id = String(event.active.id);
		if (id.startsWith(CARD_ID_PREFIX)) setActiveCardName(id.slice(CARD_ID_PREFIX.length));
	}, []);

	const handleDragCancel = useCallback(() => setActiveCardName(null), []);

	const handleDragOver = useCallback(
		(event: DragOverEvent) => {
			const { active, over } = event;
			if (!over) return;
			const activeId = String(active.id);
			const overId = String(over.id);
			if (!activeId.startsWith(CARD_ID_PREFIX) || !overId.startsWith(CARD_ID_PREFIX) || activeId === overId)
				return;
			const activeName = activeId.slice(CARD_ID_PREFIX.length);
			const overName = overId.slice(CARD_ID_PREFIX.length);
			const prev = dndItemsRef.current;
			const oldIndex = prev.indexOf(activeName);
			const newIndex = prev.indexOf(overName);
			if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
			applyDnd(arrayMove(prev, oldIndex, newIndex));
		},
		[applyDnd],
	);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			setActiveCardName(null);
			const { active, over } = event;
			if (!over) return;
			const activeId = String(active.id);
			if (!activeId.startsWith(CARD_ID_PREFIX)) return;
			const activeName = activeId.slice(CARD_ID_PREFIX.length);

			if (over.id === FOLDER_BACK_ZONE_ID) {
				onRemoveFromFolder?.(activeName);
				return;
			}

			const overId = String(over.id);
			if (!overId.startsWith(CARD_ID_PREFIX)) return;
			onReorder?.(dndItemsRef.current);
		},
		[onRemoveFromFolder, onReorder],
	);

	return (
		<DndContext
			collisionDetection={folderDragCollisionDetection}
			onDragCancel={handleDragCancel}
			onDragEnd={handleDragEnd}
			onDragOver={handleDragOver}
			onDragStart={handleDragStart}
			sensors={sensors}
		>
			<SortableContext items={sortableIds} strategy={folderSortingStrategy}>
				<div className="grid group-content">
					{catalogLinks.map((link) => (
						<DraggableFolderCatalog key={link.name} link={link} setIsAnyCardLoading={setIsAnyCardLoading} />
					))}
				</div>
			</SortableContext>
			<FolderBackDropZone />
			<DragOverlay dropAnimation={cardDropAnimation}>
				{activeCardName && linkByName[activeCardName] ? (
					<CardOverlay link={linkByName[activeCardName]} />
				) : null}
			</DragOverlay>
		</DndContext>
	);
};

export default FolderCardsDnd;
