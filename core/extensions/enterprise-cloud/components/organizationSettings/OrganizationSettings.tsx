import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { PageComponents } from "@ext/enterprise-cloud/components/organizationSettings/PageComponents";
import GesCloudOrgSettingsPage from "@ext/enterprise-cloud/types/GesCloudOrgSettingsPage";
import t from "@ext/localization/locale/translate";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@ui-kit/Collapsible";
import { Dialog, DialogContent, DialogTitle } from "@ui-kit/Dialog";
import { Divider } from "@ui-kit/Divider";
import { FeatureIcon, Icon } from "@ui-kit/Icon";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
} from "@ui-kit/Sidebar";
import { OverflowTooltip } from "@ui-kit/Tooltip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainContentBodyHeader } from "../../../enterpriseCommon/components/SettingsMainContext/MainContentBodyHeader";
import { GesCloudApi, type GesCloudSubscription } from "../../GesCloudApi";
import { ScrollContainerProvider } from "./components/ScrollContainerContext";
import { OrgSettingsHeaderProvider } from "./contexts/OrgSettingsHeaderContext";
import {
	OrganizationSettingsNavigationProvider,
	useOrganizationSettingsNavigation,
} from "./OrganizationSettingsNavigationContext";

function MainContent({ isOpen }: { isOpen: boolean }) {
	const { page, tryNavigate, tryCloseModal } = useOrganizationSettingsNavigation();
	const [subscription, setSubscription] = useState<GesCloudSubscription | null>(null);
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const onOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				tryCloseModal();
			}
		},
		[tryCloseModal],
	);

	const refreshSubscription = useCallback(async () => {
		const data = await gesCloudApi.getSubscription();
		setSubscription(data);
	}, [gesCloudApi]);

	const component = PageComponents[page];

	useEffect(() => {
		const url = new URL(window.location.href);
		url.search = "";
		window.history.replaceState(null, "", url.toString());
	}, []);

	useEffect(() => {
		void refreshSubscription();
	}, [refreshSubscription]);

	const headerRef = useRef<HTMLElement>();

	const scrollContainerRef = useRef<HTMLDivElement>(null);

	return (
		<Dialog onOpenChange={onOpenChange} open={isOpen}>
			<DialogContent showCloseButton={false} size="FS">
				<SidebarProvider className="[&>:first-child]:z-[20] min-h-0 h-full overflow-hidden ![--sidebar-width:17.25rem] [&_ul]:list-none [&_li]:line-height-[unset] [&_li]:mb-0">
					<Sidebar collapsible="offcanvas">
						<DialogTitle asChild className="-font-sans">
							<SidebarHeader className="px-4 py-3 h-[3.75rem] items-center flex-row">
								<FeatureIcon className="flex-shrink-0" icon="settings" size="sm" />
								<OverflowTooltip className="inline-block max-w-full truncate text-base font-medium">
									{t("enterprise-cloud.org-settings.title")}
								</OverflowTooltip>
							</SidebarHeader>
						</DialogTitle>
						<Divider />
						<SidebarContent className="min-h-0 p-4 [&_ul]:list-none">
							<SidebarGroup className="p-0 font-normal">
								<SidebarGroupContent>
									<SidebarMenu>
										<SidebarMenuItem>
											<SidebarMenuButton
												isActive={page === GesCloudOrgSettingsPage.ORGANIZATION}
												onClick={() => tryNavigate(GesCloudOrgSettingsPage.ORGANIZATION)}
											>
												<Icon icon="building" />
												<span>{t("enterprise-cloud.org-settings.pages.organization")}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
										<SidebarMenuItem>
											<SidebarMenuButton
												isActive={page === GesCloudOrgSettingsPage.REPOS}
												onClick={() => tryNavigate(GesCloudOrgSettingsPage.REPOS)}
											>
												<Icon icon="git-branch" />
												<span>{t("enterprise-cloud.org-settings.pages.repos")}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
										<SidebarMenuItem>
											<SidebarMenuButton
												isActive={page === GesCloudOrgSettingsPage.MEMBERS}
												onClick={() => tryNavigate(GesCloudOrgSettingsPage.MEMBERS)}
											>
												<Icon icon="users" />
												<span>{t("enterprise-cloud.org-settings.pages.users")}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
										<Collapsible className="group/sidebar-menu" defaultOpen>
											<CollapsibleTrigger asChild>
												<SidebarMenuItem>
													<SidebarMenuButton
														isActive={page === GesCloudOrgSettingsPage.BILLING}
														onClick={() => tryNavigate(GesCloudOrgSettingsPage.BILLING)}
													>
														<Icon icon="credit-card" />
														<span>{t("enterprise-cloud.org-settings.pages.billing")}</span>
														<Icon
															className="ml-auto transition-transform group-data-[state=open]/sidebar-menu:rotate-90 !w-3 !h-3 stroke-[2.5]"
															icon="chevron-right"
														/>
													</SidebarMenuButton>
												</SidebarMenuItem>
											</CollapsibleTrigger>
											<CollapsibleContent>
												<SidebarMenuSub className="border-none">
													<SidebarMenuSubButton
														isActive={page === GesCloudOrgSettingsPage.PAYMENT_METHODS}
														onClick={() =>
															tryNavigate(GesCloudOrgSettingsPage.PAYMENT_METHODS)
														}
													>
														<Icon icon="wallet" />
														<span>
															{t("enterprise-cloud.org-settings.pages.payment-methods")}
														</span>
													</SidebarMenuSubButton>
													<SidebarMenuSubButton
														isActive={page === GesCloudOrgSettingsPage.AI_WALLET}
														onClick={() => tryNavigate(GesCloudOrgSettingsPage.AI_WALLET)}
													>
														<Icon icon="coins" />
														<span>
															{t("enterprise-cloud.org-settings.pages.ai-wallet")}
														</span>
													</SidebarMenuSubButton>
													{subscription && subscription.billingMode === "legal_entity" && (
														<SidebarMenuSubButton
															isActive={page === GesCloudOrgSettingsPage.DOCUMENTS}
															onClick={() =>
																tryNavigate(GesCloudOrgSettingsPage.DOCUMENTS)
															}
														>
															<Icon icon="file-text" />
															<span>
																{t("enterprise-cloud.org-settings.pages.documents")}
															</span>
														</SidebarMenuSubButton>
													)}
												</SidebarMenuSub>
											</CollapsibleContent>
										</Collapsible>
										<SidebarMenuItem>
											<SidebarMenuButton
												isActive={page === GesCloudOrgSettingsPage.TOKENS}
												onClick={() => tryNavigate(GesCloudOrgSettingsPage.TOKENS)}
											>
												<Icon icon="key-round" />
												<span>{t("enterprise-cloud.org-settings.pages.access-tokens")}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									</SidebarMenu>
								</SidebarGroupContent>
							</SidebarGroup>
						</SidebarContent>
						<SidebarSeparator />
						<SidebarRail />
					</Sidebar>
					<main className="flex flex-col w-full max-w-full overflow-y-auto" ref={scrollContainerRef}>
						<OrgSettingsHeaderProvider value={{ headerRef }}>
							<MainContentBodyHeader headerRef={headerRef} />
							<div className="flex-1">
								<ScrollContainerProvider container={scrollContainerRef.current}>
									{component ? component({ subscription, refreshSubscription }) : null}
								</ScrollContainerProvider>
							</div>
						</OrgSettingsHeaderProvider>
					</main>
				</SidebarProvider>
			</DialogContent>
		</Dialog>
	);
}

export const GesCloudOrganizationSettingsModal = ({ onClose }: { onClose: () => void }) => {
	const [isOpen, setIsOpen] = useState(true);

	const closeHandler = useCallback(() => {
		setIsOpen(false);
		onClose();
	}, [onClose]);

	return (
		<OrganizationSettingsNavigationProvider onClose={closeHandler}>
			<MainContent isOpen={isOpen} />
		</OrganizationSettingsNavigationProvider>
	);
};
