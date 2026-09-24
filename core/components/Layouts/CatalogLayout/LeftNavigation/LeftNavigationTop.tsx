import CatalogActions from "@components/Actions/CatalogActions/CatalogActions";
import { TooltipIconButton } from "@components/Atoms/TooltipIconButton";
import { LeftNavigationTab } from "@components/Layouts/LeftNavigationTabs/LeftNavigationTab";
import NavigationTabsService from "@components/Layouts/LeftNavigationTabs/NavigationTabsService";
import { useSidebarsPinStore } from "@core-ui/ContextServices/Sidebars/SidebarsPinStore";
import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import AgentSkillService from "@ext/agent/components/skills/AgentSkillService";
import PromptTab from "@ext/ai/components/Tab/PromptTab";
import BranchUpdaterService from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import OnBranchUpdateCaller from "@ext/git/actions/Branch/BranchUpdaterService/model/OnBranchUpdateCaller";
import t from "@ext/localization/locale/translate";
import FragmentService from "@ext/markdown/elements/fragment/edit/components/Tab/FragmentService";
import TemplateService from "@ext/templates/components/TemplateService";
import { useSidebar } from "@ui-kit/Sidebar";
import { useEffect } from "react";
import TopBarContent from "../../../ArticlePage/Bars/TopBarContent";

interface LeftNavigationTopProps {
	forceDesktop?: boolean;
	onClose?: () => void;
}

const LeftNavigationTop = ({ forceDesktop, onClose }: LeftNavigationTopProps) => {
	const setLeftPinned = useSidebarsPinStore((state) => state.setLeftPinned);
	const catalogNotFound = useCatalogPropsStore((state) => state.data.notFound);
	const { isMobile, toggleSidebar } = useSidebar();
	const { isTauri, isWeb } = usePlatform();
	const { topTab } = NavigationTabsService.value;

	useEffect(() => {
		const onBranchChange = (_, caller: OnBranchUpdateCaller) => {
			const isDefaultView = ArticleViewService.isDefaultView();

			if (isDefaultView) return;
			NavigationTabsService.setTop(LeftNavigationTab.None);

			if (caller === OnBranchUpdateCaller.Init || caller === OnBranchUpdateCaller.CheckoutToNewCreatedBranch)
				return;
			[AgentSkillService, FragmentService, TemplateService].forEach((context) => context.closeItem());
		};

		BranchUpdaterService.addListener(onBranchChange);

		return () => {
			BranchUpdaterService.removeListener(onBranchChange);
		};
	}, []);

	return (
		<>
			<div className="flex h-[52px] items-center gap-1 px-2.5 py-2.5" data-testid="left-navigation-top">
				<TopBarContent forceDesktop={forceDesktop} toggleSidebar={toggleSidebar} />
				<div className="flex items-center">
					{(!isMobile || forceDesktop) && (
						<TooltipIconButton
							className="shrink-0"
							icon="panel-left"
							iconClassName="size-4"
							onClick={isMobile ? onClose : () => setLeftPinned(false)}
							size="sm"
							tooltip={t("left-navigation.collapse")}
							variant="ghost"
						/>
					)}
					<CatalogActions currentTab={topTab} isCatalogExist={!catalogNotFound} />
				</div>
			</div>
			{(isTauri || isWeb) && !catalogNotFound && <PromptTab show={topTab === LeftNavigationTab.Prompt} />}
		</>
	);
};

export default LeftNavigationTop;
