import { DragOverlay } from "@dnd-kit/core";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { cardDropAnimation } from "../dnd/sensors";
import type { ActiveDrag } from "../dnd/types";
import { CardOverlay, FolderOverlay, GroupOverlay } from "../overlays";
import type { HomeSections } from "../utils/homeLayoutTypes";

interface SectionOverlayProps {
	activeDrag: ActiveDrag;
	linkByName: Record<string, CatalogLink>;
	dndSections: HomeSections;
}

const SectionOverlay = ({ activeDrag, linkByName, dndSections }: SectionOverlayProps) => {
	const activeSection =
		activeDrag?.type === "group" ? dndSections.find((section) => section.id === activeDrag.key) : null;

	return (
		<DragOverlay dropAnimation={cardDropAnimation}>
			{activeDrag?.type === "card" && linkByName[activeDrag.name] ? (
				<CardOverlay link={linkByName[activeDrag.name]} />
			) : activeDrag?.type === "group" && activeSection ? (
				<GroupOverlay
					containerKey={activeDrag.key}
					items={activeSection.items}
					linkByName={linkByName}
					title={activeDrag.title}
				/>
			) : activeDrag?.type === "folder" ? (
				<FolderOverlay folder={activeDrag.folder} linkByName={linkByName} />
			) : null}
		</DragOverlay>
	);
};

export default SectionOverlay;
