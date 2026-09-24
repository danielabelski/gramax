import Link from "@components/Atoms/Link";
import Url from "@core-ui/ApiServices/Types/Url";
import { NavigationCollapseChevron } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/NavigationCollapseChevron";
import { NavigationItemLink } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/NavigationItemLink";
import { NavigationTreeItemActions } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/NavigationTreeItemActions";
import { ReadonlyMenuRow } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/ReadonlyMenuButton";
import { NAVIGATION_HOVER_ID_ATTR } from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { SidebarMenuItem, SidebarMenuSubButton, SidebarMenuSubItem } from "@ui-kit/Sidebar";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import type { MouseEvent } from "react";

interface ReadonlyFolderItemProps {
	data: ItemLink;
	level: number;
	open: boolean;
	isNested: boolean;
	isSelected: boolean;
	onClick: (e: MouseEvent) => void;
}

export const ReadonlyFolderItem = ({ data, level, open, isNested, isSelected, onClick }: ReadonlyFolderItemProps) => {
	const ItemWrapper = isNested ? SidebarMenuSubItem : SidebarMenuItem;
	const ButtonComponent = isNested ? SidebarMenuSubButton : ReadonlyMenuRow;

	const body = (
		<>
			<span className="flex min-w-0 flex-1 items-center gap-2">
				<TextOverflowTooltip>{data?.title || data?.external || <>&nbsp;</>}</TextOverflowTooltip>
				<NavigationCollapseChevron open={open} />
			</span>
			<NavigationTreeItemActions itemLink={data} />
		</>
	);

	return (
		<NavigationItemLink data={data} disabled={isNested}>
			<ItemWrapper
				className="relative select-none hover:cursor-pointer"
				data-qa={`catalog-navigation-category-link-level-${level}`}
			>
				<ButtonComponent
					{...{ [NAVIGATION_HOVER_ID_ATTR]: data.ref.path }}
					aria-label={data?.title || data?.external}
					className="group/nav h-7 min-w-0 py-1.5 pr-1.5 font-light text-primary-fg data-[active=true]:font-normal select-none"
					isActive={isSelected}
					onClick={onClick}
					title={data?.title || data?.external}
					{...(isNested ? { asChild: true } : {})}
				>
					{isNested ? <Link href={Url.from(data)}>{body}</Link> : body}
				</ButtonComponent>
			</ItemWrapper>
		</NavigationItemLink>
	);
};
