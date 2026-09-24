import Link from "@components/Atoms/Link";
import Url from "@core-ui/ApiServices/Types/Url";
import { NavigationItemLink } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/NavigationItemLink";
import { NavigationTreeItemActions } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/NavigationTreeItemActions";
import { ReadonlyMenuButton } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/ReadonlyMenuButton";
import {
	NAVIGATION_HOVER_ID_ATTR,
	NAVIGATION_ROW_SELECTOR,
} from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { SidebarMenuItem, SidebarMenuSubButton, SidebarMenuSubItem } from "@ui-kit/Sidebar";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import type { MouseEvent } from "react";

interface ReadonlyArticleItemProps {
	data: ItemLink;
	level: number;
	isNested: boolean;
	isSelected: boolean;
	onClick: (e: MouseEvent) => void;
}

export const ReadonlyArticleItem = ({ data, level, isNested, isSelected, onClick }: ReadonlyArticleItemProps) => {
	const ItemWrapper = isNested ? SidebarMenuSubItem : SidebarMenuItem;
	const ButtonComponent = isNested ? SidebarMenuSubButton : ReadonlyMenuButton;
	const isLinkInsideButton = isNested && !isSelected;

	const body = (
		<>
			<span className="flex min-w-0 flex-1 items-center gap-2">
				<TextOverflowTooltip offsetBoundarySelector={NAVIGATION_ROW_SELECTOR} side="right">
					{data?.title || data?.external || <>&nbsp;</>}
				</TextOverflowTooltip>
			</span>
			<NavigationTreeItemActions itemLink={data} />
		</>
	);

	return (
		<NavigationItemLink data={data} disabled={isSelected || isNested}>
			<ItemWrapper
				className="relative select-none hover:cursor-pointer"
				data-qa={`catalog-navigation-article-link-level-${level}`}
			>
				<ButtonComponent
					{...{ [NAVIGATION_HOVER_ID_ATTR]: data.ref.path }}
					aria-label={data?.title || data?.external}
					className="group/nav h-7 py-1.5 pr-1.5 font-light text-primary-fg data-[active=true]:font-normal select-none"
					isActive={isSelected}
					onClick={onClick}
					title={data?.title || data?.external}
					{...(isLinkInsideButton ? { asChild: true } : { type: "button" })}
				>
					{isLinkInsideButton ? <Link href={Url.from(data)}>{body}</Link> : body}
				</ButtonComponent>
			</ItemWrapper>
		</NavigationItemLink>
	);
};
