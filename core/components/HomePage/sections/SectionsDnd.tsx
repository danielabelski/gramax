import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { type Dispatch, type SetStateAction, useMemo } from "react";
import { GROUP_ID_PREFIX } from "../dnd/ids";
import { useHomepageDnd } from "../dnd/useHomepageDnd";
import type { HomeSection, HomeSections } from "../utils/homeLayoutTypes";
import { UNCATEGORIZED_ID } from "../utils/homeLayoutTypes";
import SectionGroups from "./SectionGroups";
import SectionOverlay from "./SectionOverlay";
import SortableGroup from "./SortableGroup";

interface SectionsDndProps {
	sections: HomeSections;
	linkByName: Record<string, CatalogLink>;
	linksOf: (section: HomeSection) => CatalogLink[];
	setPreviewFolderId: Dispatch<SetStateAction<string | null>>;
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
}

const SectionsDnd = ({ sections, linkByName, linksOf, setPreviewFolderId, setIsAnyCardLoading }: SectionsDndProps) => {
	const {
		sensors,
		collisionDetection,
		dndSections,
		activeDrag,
		dropIndicator,
		layoutAnimationTick,
		onDragStart,
		onDragMove,
		onDragOver,
		onDragEnd,
		onDragCancel,
	} = useHomepageDnd(sections, linkByName);

	const sortableSectionIds = useMemo(
		() =>
			dndSections
				.filter((section) => section.id !== UNCATEGORIZED_ID)
				.map((section) => `${GROUP_ID_PREFIX}${section.id}`),
		[dndSections],
	);

	return (
		<DndContext
			collisionDetection={collisionDetection}
			onDragCancel={onDragCancel}
			onDragEnd={onDragEnd}
			onDragMove={onDragMove}
			onDragOver={onDragOver}
			onDragStart={onDragStart}
			sensors={sensors}
		>
			<SortableContext items={sortableSectionIds} strategy={verticalListSortingStrategy}>
				<SectionGroups
					dndSections={dndSections}
					dropIndicator={dropIndicator}
					editMode
					layoutAnimationTick={layoutAnimationTick}
					linkByName={linkByName}
					linksOf={linksOf}
					setIsAnyCardLoading={setIsAnyCardLoading}
					setPreviewFolderId={setPreviewFolderId}
					sortableGroup={SortableGroup}
				/>
			</SortableContext>
			<SectionOverlay activeDrag={activeDrag} dndSections={dndSections} linkByName={linkByName} />
		</DndContext>
	);
};

export default SectionsDnd;
