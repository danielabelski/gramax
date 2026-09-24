import Card from "@components/HomePage/Card";
import Folder from "@components/HomePage/folders/Folder";
import Url from "@core-ui/ApiServices/Types/Url";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { useCallback } from "react";
import Link from "../../Atoms/Link";
import { useHomeGroup } from "../HomeGroupContext";
import { canNavigateHomeFolder, type HomeItem } from "../utils/homeLayoutTypes";

interface GroupStaticItemsProps {
	items: HomeItem[];
	linkByName: Record<string, CatalogLink>;
}

const GroupStaticItems = ({ items, linkByName }: GroupStaticItemsProps) => {
	const { setIsAnyCardLoading, onOpenFolder } = useHomeGroup();
	const handleCardClick = useCallback(() => setIsAnyCardLoading(true), [setIsAnyCardLoading]);

	return (
		<div className="grid group-content">
			{items.map((item) =>
				item.type === "catalog" ? (
					linkByName[item.name] ? (
						<Card key={item.name} link={linkByName[item.name]} name={item.name} onClick={handleCardClick} />
					) : null
				) : canNavigateHomeFolder(item) ? (
					<Link href={Url.from({ pathname: item.href })} key={item.id}>
						<Folder folder={item} linkByName={linkByName} />
					</Link>
				) : (
					<div className="cursor-pointer" key={item.id} onClick={() => onOpenFolder?.(item)}>
						<Folder folder={item} linkByName={linkByName} />
					</div>
				),
			)}
		</div>
	);
};

export default GroupStaticItems;
