import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { useMemo } from "react";
import Card from "./Card";
import Folder from "./folders/Folder";
import Group from "./Group";
import { HomeGroupProvider } from "./HomeGroupContext";
import type { HomeFolder, HomeItem } from "./utils/homeLayoutTypes";

// an overlay re-renders on every drag frame, so nothing it hands to the memoized `Card`/`Folder` may be rebuilt here
const noop = () => {};

interface CardOverlayProps {
	link: CatalogLink;
}

export const CardOverlay = ({ link }: CardOverlayProps) => (
	<div className="cursor-grabbing">
		<Card className="!cursor-grabbing" link={link} name={link.name} onClick={noop} />
	</div>
);

interface GroupOverlayProps {
	title?: string;
	items: HomeItem[];
	linkByName: Record<string, CatalogLink>;
	containerKey: string;
}

// no `editMode`: the overlay is a still picture of the section being dragged, so its items stay static
export const GroupOverlay = ({ title, items, linkByName, containerKey }: GroupOverlayProps) => {
	const groupContext = useMemo(() => ({ setIsAnyCardLoading: noop, linkByName }), [linkByName]);

	return (
		<div className="cursor-grabbing">
			<HomeGroupProvider value={groupContext}>
				<Group catalogLinks={[]} containerKey={containerKey} items={items} title={title} />
			</HomeGroupProvider>
		</div>
	);
};

interface FolderOverlayProps {
	folder: HomeFolder;
	linkByName: Record<string, CatalogLink>;
}

export const FolderOverlay = ({ folder, linkByName }: FolderOverlayProps) => (
	<div className="cursor-grabbing">
		<Folder className="!cursor-grabbing" folder={folder} linkByName={linkByName} />
	</div>
);
