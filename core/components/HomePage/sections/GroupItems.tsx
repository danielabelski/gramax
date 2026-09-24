import Card from "@components/HomePage/Card";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { lazy, Suspense, useCallback } from "react";
import { useHomeGroup } from "../HomeGroupContext";
import type { HomeItem } from "../utils/homeLayoutTypes";
import GroupStaticItems from "./GroupStaticItems";

// the only homepage path into dnd-kit for items — the static list below renders while the chunk loads
const GroupDraggableItems = lazy(() => import("./GroupDraggableItems"));

interface GroupItemsProps {
	catalogLinks: CatalogLink[];
	containerKey?: string;
	items?: HomeItem[];
}

const GroupItems = ({ catalogLinks, containerKey, items }: GroupItemsProps) => {
	const { editMode, linkByName, setIsAnyCardLoading } = useHomeGroup();
	const handleCardClick = useCallback(() => setIsAnyCardLoading(true), [setIsAnyCardLoading]);

	if (items && linkByName) {
		const staticItems = <GroupStaticItems items={items} linkByName={linkByName} />;
		if (!editMode || containerKey === undefined) return staticItems;
		return (
			<Suspense fallback={staticItems}>
				<GroupDraggableItems containerKey={containerKey} items={items} linkByName={linkByName} />
			</Suspense>
		);
	}

	return (
		<div className="grid group-content">
			{catalogLinks.map((link) => (
				<Card key={link.name} link={link} name={link.name} onClick={handleCardClick} />
			))}
		</div>
	);
};

export default GroupItems;
