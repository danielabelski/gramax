import {
	type CollisionDetection,
	closestCenter,
	closestCorners,
	pointerWithin,
	type UniqueIdentifier,
} from "@dnd-kit/core";
import type { HomeSections } from "../utils/homeLayoutTypes";
import { cardId, DROP_ZONE_ID_PREFIX, folderId, GROUP_ID_PREFIX } from "./ids";

export const createHomepageCollisionDetection =
	(getItems: () => HomeSections): CollisionDetection =>
	(args) => {
		const activeId = String(args.active.id);
		if (activeId.startsWith(GROUP_ID_PREFIX)) {
			const groups = args.droppableContainers.filter((c) => String(c.id).startsWith(GROUP_ID_PREFIX));
			return closestCorners({ ...args, droppableContainers: groups });
		}

		const containerDroppables = args.droppableContainers.filter((c) =>
			String(c.id).startsWith(DROP_ZONE_ID_PREFIX),
		);

		const closestZoneByY = () => {
			const pointer = args.pointerCoordinates;
			if (!pointer) return [];
			const closest = containerDroppables.reduce<{ id: UniqueIdentifier; distance: number } | null>(
				(best, container) => {
					const rect = args.droppableRects.get(container.id);
					if (!rect) return best;
					const distance = Math.max(rect.top - pointer.y, pointer.y - rect.bottom, 0);
					return !best || distance < best.distance ? { id: container.id, distance } : best;
				},
				null,
			);
			return closest ? [{ id: closest.id }] : [];
		};

		const pointerResult = pointerWithin({ ...args, droppableContainers: containerDroppables });
		const containerResult = pointerResult.length > 0 ? pointerResult : closestZoneByY();
		if (containerResult.length === 0) return [];

		const overContainerKey = String(containerResult[0].id).slice(DROP_ZONE_ID_PREFIX.length);
		const itemsInContainer = getItems().find((section) => section.id === overContainerKey)?.items ?? [];

		if (itemsInContainer.length === 0) return containerResult;

		const itemIds = new Set(
			itemsInContainer.map((item) => (item.type === "catalog" ? cardId(item.name) : folderId(item.id))),
		);
		const itemDroppables = args.droppableContainers.filter((c) => itemIds.has(String(c.id)));
		if (itemDroppables.length === 0) return containerResult;
		const itemResult = closestCenter({ ...args, droppableContainers: itemDroppables });
		return itemResult.length > 0 ? itemResult : containerResult;
	};
