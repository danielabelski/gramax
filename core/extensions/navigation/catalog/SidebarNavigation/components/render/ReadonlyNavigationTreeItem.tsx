import { cn } from "@core-ui/utils/cn";
import { useCollapsibleAnimation } from "@ext/navigation/catalog/SidebarNavigation/hooks/useCollapsibleAnimation";
import { useNavigationItem } from "@ext/navigation/catalog/SidebarNavigation/hooks/useNavigationItem";
import { useNavigationItemClick } from "@ext/navigation/catalog/SidebarNavigation/hooks/useNavigationItemClick";
import { Collapsible, CollapsibleContent } from "@ui-kit/Collapsible";
import { SidebarMenuSub } from "@ui-kit/Sidebar";
import { memo } from "react";
import { ReadonlyArticleItem } from "./ReadonlyArticleItem";
import { ReadonlyFolderItem } from "./ReadonlyFolderItem";

interface ReadonlyNavigationTreeItemProps {
	id: string;
	level: number;
	virtualized?: boolean;
}

const ReadonlyNavigationTreeItemInner = ({ id, level, virtualized = false }: ReadonlyNavigationTreeItemProps) => {
	const { data, children: childIds, open, isSelected, toggleExpanded, select } = useNavigationItem(id);

	const isFolder = childIds.length > 0;
	const isNested = level > 1;
	const { animating, handleOpenChange, handleAnimationEnd } = useCollapsibleAnimation((next) =>
		toggleExpanded(id, next),
	);

	const handleClick = useNavigationItemClick({
		itemPath: data?.pathname,
		isSelected,
		onSelect: () => {
			if (isFolder && isSelected) return toggleExpanded(id, !open);
			select(id);
		},
	});

	if (!data) return null;

	if (isFolder) {
		return (
			<Collapsible
				className="relative flex flex-col gap-0.5"
				onOpenChange={virtualized ? (next) => toggleExpanded(id, next) : handleOpenChange}
				open={open}
			>
				<ReadonlyFolderItem
					data={data}
					isNested={isNested}
					isSelected={isSelected}
					level={level}
					onClick={handleClick}
					open={open}
				/>
				{!virtualized && (
					<CollapsibleContent
						className={cn(!animating && "data-[state=open]:!overflow-visible")}
						data-navigation-children
						onAnimationEnd={handleAnimationEnd}
					>
						<div className="relative ml-4">
							<SidebarMenuSub className="ml-0 gap-0 border-none p-0 [&>*:not(:first-child)]:pt-0.5">
								{childIds.map((childId) => (
									<ReadonlyNavigationTreeItem id={childId} key={childId} level={level + 1} />
								))}
							</SidebarMenuSub>
						</div>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	}

	return (
		<ReadonlyArticleItem
			data={data}
			isNested={isNested}
			isSelected={isSelected}
			level={level}
			onClick={handleClick}
		/>
	);
};

export const ReadonlyNavigationTreeItem = memo(ReadonlyNavigationTreeItemInner);
