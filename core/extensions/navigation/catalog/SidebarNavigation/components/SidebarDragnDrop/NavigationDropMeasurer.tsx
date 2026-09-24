import { useDndContext } from "@dnd-kit/core";
import { useNavigationTreeStore } from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import { invalidateNavigationCollisionDetection } from "@ext/navigation/catalog/SidebarNavigation/utils/navigationCollisionDetection";
import { useEffect } from "react";

/**
 * `MeasuringStrategy.WhileDragging` with `MeasuringFrequency.Optimized` measures droppables only when the set of
 * them changes — for an auto-expanded section that is the moment its children mount, while the open is still
 * animating. Those halfway rects would then stand for the rest of the drag and the drop target would sit below
 * the pointer. Re-measure once the animation has settled.
 *
 * Lives inside `DndContext`: `measureDroppableContainers` comes from it.
 */
export const NavigationDropMeasurer = () => {
	const { measureDroppableContainers } = useDndContext();
	const { layoutVersion, isDndActive } = useNavigationTreeStore((s) => ({
		layoutVersion: s.layoutVersion,
		isDndActive: s.draggingId !== null,
	}));

	// biome-ignore lint/correctness/useExhaustiveDependencies: `layoutVersion` is the trigger, not an input
	useEffect(() => {
		if (!isDndActive) return;
		invalidateNavigationCollisionDetection();
		// no ids — an expand moves every row below it, so all of them need fresh rects
		measureDroppableContainers([]);
	}, [layoutVersion, isDndActive, measureDroppableContainers]);

	return null;
};
