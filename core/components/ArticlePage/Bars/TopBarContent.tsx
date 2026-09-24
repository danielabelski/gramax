import { TopBarContentDesktop } from "@components/ArticlePage/Bars/TopBarContentDesktop";
import { TopBarContentMobile } from "@components/ArticlePage/Bars/TopBarContentMobile";
import { LeftNavigationTab } from "@components/Layouts/LeftNavigationTabs/LeftNavigationTab";
import NavigationTabsService from "@components/Layouts/LeftNavigationTabs/NavigationTabsService";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { useSidebar } from "@ui-kit/Sidebar";
import { useEffect } from "react";

interface TopBarContentProps {
	forceDesktop?: boolean;
	toggleSidebar?: () => void;
}

const TopBarContent = ({ toggleSidebar, forceDesktop }: TopBarContentProps) => {
	const { isMobile } = useSidebar();
	const catalogName = useCatalogPropsStore((state) => state.data.name);

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	useEffect(() => {
		NavigationTabsService.setTop(LeftNavigationTab.None);
	}, [catalogName]);

	if (isMobile && !forceDesktop) return <TopBarContentMobile toggleSidebar={toggleSidebar} />;
	return <TopBarContentDesktop />;
};

export default TopBarContent;
