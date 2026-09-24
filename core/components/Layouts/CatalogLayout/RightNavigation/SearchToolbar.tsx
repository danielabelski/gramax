import { useItemLinks } from "@core-ui/stores/ItemLinksStore/ItemLinksStore.provider";
import t from "@ext/localization/locale/translate";
import { Search } from "@ext/serach/components/Search";
import { GlassToolbar } from "@ui-kit/GlassToolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useIsRightNavigationCollapsed } from "./catalogViewportWidthStore";
import { SearchButton } from "./SearchButton";

export const SearchToolbar = () => {
	const itemLinks = useItemLinks();
	const isCollapsed = useIsRightNavigationCollapsed();
	const trigger = <SearchButton className="w-full justify-start" data-testid="catalog-search-trigger" />;

	return (
		<GlassToolbar className="min-w-0 flex-1" variant="single">
			<Tooltip>
				<Search
					isHomePage={false}
					itemLinks={itemLinks}
					trigger={isCollapsed ? <TooltipTrigger asChild>{trigger}</TooltipTrigger> : trigger}
				/>
				{isCollapsed && <TooltipContent focus="high">{t("search.name")}</TooltipContent>}
			</Tooltip>
		</GlassToolbar>
	);
};
