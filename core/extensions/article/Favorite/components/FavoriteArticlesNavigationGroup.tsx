import Link from "@components/Atoms/Link";
import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { NavigationCollapseChevron } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/NavigationCollapseChevron";
import { NavigationTreeItemActions } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/NavigationTreeItemActions";
import { ReadonlyMenuButton } from "@ext/navigation/catalog/SidebarNavigation/components/Helpers/ReadonlyMenuButton";
import { isOwnedByControl } from "@ext/navigation/catalog/SidebarNavigation/hooks/useNavigationItemClick";
import { NAVIGATION_HOVER_ID_ATTR } from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { Collapsible, CollapsibleContent } from "@ui-kit/Collapsible";
import { Icon } from "@ui-kit/Icon";
import {
	SidebarGroup,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@ui-kit/Sidebar";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { useState } from "react";

interface FavoriteArticlesNavigationGroupProps {
	catalogName?: string;
	items: ItemLink[];
}

const FAVORITE_ARTICLES_OPEN_KEY = "favorite-articles-navigation-open";

const getStorageKey = (catalogName?: string) => `${FAVORITE_ARTICLES_OPEN_KEY}:${catalogName ?? ""}`;
const getInitialOpen = (catalogName?: string) =>
	typeof window === "undefined" || window.localStorage.getItem(getStorageKey(catalogName)) !== "false";

export const FavoriteArticlesNavigationGroup = ({ catalogName, items }: FavoriteArticlesNavigationGroupProps) => {
	const [open, setOpen] = useState(() => getInitialOpen(catalogName));
	if (!items.length) return null;
	const setOpenAndPersist = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (typeof window !== "undefined") window.localStorage.setItem(getStorageKey(catalogName), String(nextOpen));
	};

	return (
		<SidebarGroup className="relative mt-0.5 py-0 px-2.5" data-favorite-articles-group>
			<Collapsible className="relative flex flex-col gap-0.5" onOpenChange={setOpenAndPersist} open={open}>
				<SidebarMenuItem className="relative list-none select-none hover:cursor-pointer">
					<ReadonlyMenuButton
						className={cn(
							"group/nav mb-0.5 h-8 select-none font-normal cursor-pointer gap-2 p-2 pr-1.5",
							"text-xs text-muted hover:bg-secondary-bg-hover hover:text-secondary-fg bg-transparent",
						)}
						onClick={() => setOpenAndPersist(!open)}
						type="button"
					>
						<Icon icon="star" />
						<span className="flex min-w-0 flex-1 items-center gap-2">
							<TextOverflowTooltip>{t("favorites-articles")}</TextOverflowTooltip>
							<NavigationCollapseChevron open={open} />
						</span>
					</ReadonlyMenuButton>
				</SidebarMenuItem>
				<CollapsibleContent data-testid="favorite-articles-content">
					<div className="relative">
						<SidebarMenuSub className="ml-0 gap-0 border-none p-0 [&>*:not(:first-child)]:pt-0.5">
							{items.map((item) => (
								<SidebarMenuSubItem className="relative list-none select-none" key={item.ref.path}>
									<SidebarMenuSubButton
										{...{ [NAVIGATION_HOVER_ID_ATTR]: item.ref.path }}
										asChild
										className="group/nav h-7 py-1.5 pr-1.5 font-light text-primary-fg data-[active=true]:font-normal"
										isActive={item.isCurrentLink}
									>
										<Link
											href={{ pathname: item.pathname }}
											onClick={(event) => {
												if (!isOwnedByControl(event)) return;
												event.preventDefault();
												event.stopPropagation();
											}}
										>
											<span className="flex min-w-0 flex-1 items-center gap-2">
												<TextOverflowTooltip>{item.title}</TextOverflowTooltip>
											</span>
											<NavigationTreeItemActions itemLink={item} />
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							))}
						</SidebarMenuSub>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</SidebarGroup>
	);
};
