import { TopBarContentMobile } from "@components/ArticlePage/Bars/TopBarContentMobile";
import { useRouter } from "@core/Api/useRouter";
import { useSidebarsPinStore } from "@core-ui/ContextServices/Sidebars/SidebarsPinStore";
import LeftNavViewContentContainer from "@core-ui/ContextServices/views/leftNavView/LeftNavViewContainer";
import useSidebarFloating from "@core-ui/hooks/useSidebarFloating";
import { getEditorStore } from "@core-ui/stores/EditorStore";
import { useItemLinks } from "@core-ui/stores/ItemLinksStore/ItemLinksStore.provider";
import stopOpeningPanels from "@core-ui/utils/stopOpeningPanels ";
import { useSidebar } from "@ui-kit/Sidebar";
import { useCallback, useEffect, useRef } from "react";
import MobileNavigationBottom from "../MobileNavigationBottom";
import { useCanSeeNavigationBottom } from "../useCanSeeNavigationBottom";
import { CollapsedNavigationToolbar } from "./CollapsedNavigationToolbar";
import LeftNavigationBottom from "./LeftNavigationBottom";
import LeftNavigationLayout from "./LeftNavigationLayout";
import LeftNavigationTop from "./LeftNavigationTop";
import { MobileNavigationHeader } from "./MobileNavigationHeader";
import { useCollapsedNavigationPresentation } from "./useCollapsedNavigationPresentation";

const navsSymbol = Symbol();

const LeftNavigationComponent = () => {
	const { isMobile, openMobile, setOpenMobile, toggleSidebar } = useSidebar();
	const isPinned = useSidebarsPinStore((state) => state.isLeftPinned);
	const itemLinks = useItemLinks();
	const editor = getEditorStore().editor;
	const canSeeNavigationBottom = useCanSeeNavigationBottom();

	const sidebarRef = useRef<HTMLDivElement>(null);

	const isCollapsed = !isMobile && !isPinned;
	const { handleTransitionEnd, isCollapsedPresentation } = useCollapsedNavigationPresentation(!isPinned, isMobile);
	const { isHoverActive } = useSidebarFloating(sidebarRef, isCollapsed && isCollapsedPresentation);

	const isVisible = isMobile ? openMobile : isPinned || (isCollapsedPresentation && isHoverActive);

	useEffect(() => {
		const onSelectionChange = () => stopOpeningPanels(navsSymbol, editor.view);

		editor?.on("selectionUpdate", onSelectionChange);
		return () => {
			editor?.off("selectionUpdate", onSelectionChange);
		};
	}, [editor]);

	const closeNavigation = useCallback(() => setOpenMobile(false), [setOpenMobile]);

	// The overlay's job ends where the user lands: any route change closes it, on mobile only.
	const { path } = useRouter();
	const landedPath = useRef(path);
	useEffect(() => {
		if (landedPath.current === path) return;
		landedPath.current = path;
		if (isMobile) setOpenMobile(false);
	}, [path, isMobile, setOpenMobile]);

	const leftNavigationTop = isCollapsedPresentation ? undefined : <LeftNavigationTop />;
	const leftNavigationContent = (
		<LeftNavViewContentContainer closeNavigation={isMobile ? closeNavigation : undefined} itemLinks={itemLinks} />
	);

	if (isMobile) {
		return (
			<>
				{!openMobile && (
					<MobileNavigationHeader>
						<TopBarContentMobile toggleSidebar={toggleSidebar} />
					</MobileNavigationHeader>
				)}
				<LeftNavigationLayout
					isCollapsed={false}
					isMobile
					isVisible={false}
					leftNavigationBottom={
						canSeeNavigationBottom ? (
							<MobileNavigationBottom closeNavigation={closeNavigation} />
						) : undefined
					}
					leftNavigationContent={leftNavigationContent}
					leftNavigationTop={<LeftNavigationTop forceDesktop onClose={closeNavigation} />}
				/>
			</>
		);
	}

	return (
		<>
			{isCollapsed && <CollapsedNavigationToolbar />}
			<LeftNavigationLayout
				isCollapsed={isCollapsedPresentation}
				isVisible={isVisible}
				leftNavigationBottom={canSeeNavigationBottom ? <LeftNavigationBottom /> : undefined}
				leftNavigationContent={leftNavigationContent}
				leftNavigationTop={leftNavigationTop}
				onTransitionEnd={handleTransitionEnd}
				sidebarRef={sidebarRef}
			/>
		</>
	);
};

export default LeftNavigationComponent;
