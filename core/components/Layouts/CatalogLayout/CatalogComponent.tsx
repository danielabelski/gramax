import { CatalogFloatingPanels } from "@components/Layouts/CatalogLayout/CatalogFloatingPanels";
import RightNavigationComponent from "@components/Layouts/CatalogLayout/RightNavigation/RightNavigationComponent";
import type { ArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import IsMacService from "@core-ui/ContextServices/IsMac";
import { useSidebarsPinStore } from "@core-ui/ContextServices/Sidebars/SidebarsPinStore";
import useArticleScrollPosition from "@core-ui/hooks/useArticleScrollPosition";
import { useNativeTitlebarOffset } from "@core-ui/hooks/useNativeTitlebarOffset";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { SidebarInset, SidebarProvider } from "@ui-kit/Sidebar";
import type { CSSProperties } from "react";
import ArticleComponent from "./ArticleLayout/ArticleComponent";
import CatalogLayout from "./CatalogLayout";
import { CatalogViewportLayout } from "./CatalogViewportLayout";
import LeftNavigationComponent from "./LeftNavigation/LeftNavigationComponent";

const SIDEBAR_STYLE = { "--sidebar-width": "var(--left-nav-width)" } as CSSProperties;

const CatalogComponent = ({ data, children }: { data: ArticlePageData; children: JSX.Element }) => {
	const setLeftPinned = useSidebarsPinStore((state) => state.setLeftPinned);
	const { isTauri } = usePlatform();
	useNativeTitlebarOffset(isTauri && IsMacService.value);
	useArticleScrollPosition(data);

	return (
		<CatalogLayout>
			<SidebarProvider
				className="h-full min-h-0 w-full"
				onOpenChange={(open) => {
					if (open) setLeftPinned(true);
				}}
				open={false}
				style={SIDEBAR_STYLE}
			>
				<LeftNavigationComponent />
				<SidebarInset className="min-h-0 min-w-0 bg-transparent">
					<CatalogViewportLayout rightNavigation={<RightNavigationComponent />}>
						<ArticleComponent article={children} />
					</CatalogViewportLayout>
					<CatalogFloatingPanels />
				</SidebarInset>
			</SidebarProvider>
		</CatalogLayout>
	);
};

export default CatalogComponent;
