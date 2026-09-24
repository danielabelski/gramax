import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { type Dispatch, lazy, type SetStateAction, Suspense, useCallback, useMemo } from "react";
import Card from "../Card";

// the static grid below doubles as the fallback, so the layout is already on screen while the chunk loads
const FolderCardsDnd = lazy(() => import("./FolderCardsDnd"));

interface FolderCardsGridProps {
	items: string[];
	linkByName: Record<string, CatalogLink>;
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
	editMode?: boolean;
	onReorder?: (newOrder: string[]) => void;
	onRemoveFromFolder?: (catalogName: string) => void;
}

const FolderCardsGrid = ({
	items,
	linkByName,
	setIsAnyCardLoading,
	editMode,
	onReorder,
	onRemoveFromFolder,
}: FolderCardsGridProps) => {
	const handleCardClick = useCallback(() => setIsAnyCardLoading(true), [setIsAnyCardLoading]);
	const catalogLinks = useMemo(
		() => items.map((name) => linkByName[name]).filter((l): l is CatalogLink => Boolean(l)),
		[items, linkByName],
	);

	const staticGrid = (
		<div className="grid group-content">
			{catalogLinks.map((link) => (
				<Card key={link.name} link={link} name={link.name} onClick={handleCardClick} />
			))}
		</div>
	);

	if (!editMode || !onReorder || !onRemoveFromFolder) return staticGrid;

	return (
		<Suspense fallback={staticGrid}>
			<FolderCardsDnd
				items={items}
				linkByName={linkByName}
				onRemoveFromFolder={onRemoveFromFolder}
				onReorder={onReorder}
				setIsAnyCardLoading={setIsAnyCardLoading}
			/>
		</Suspense>
	);
};

export default FolderCardsGrid;
