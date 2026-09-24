import HomeLayoutControls from "@components/HomePage/HomeLayoutControls";
import { leaveEditModeGuard } from "@components/HomePage/leaveEditModeGuard";
import { useRouter } from "@core/Api/useRouter";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { cn } from "@core-ui/utils/cn";
import useDesktopEnterpriseSession from "@ext/enterprise/components/SingInOut/hooks/useDesktopEnterpriseSession";
import useSignOut from "@ext/enterprise/components/SingInOut/hooks/useSignOut";
import { useEnterpriseSignIn } from "@ext/enterprise/components/SingInOut/SignInEnterprise";
import type SignOutGesCloud from "@ext/enterprise-cloud/components/SignInOut/GesCloudSignOutModal";
import { GesCloudApi } from "@ext/enterprise-cloud/GesCloudApi";
import t from "@ext/localization/locale/translate";
import { Level } from "@ext/settings/logic/settings";
import { feature } from "@ext/toggleFeatures/features";
import {
	Avatar,
	AvatarFallback,
	AvatarLabel,
	AvatarLabelAvatar,
	AvatarLabelDescription,
	AvatarLabelTitle,
	getAvatarFallback,
} from "@ui-kit/Avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuTriggerButton,
} from "@ui-kit/Dropdown";
import { GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { Icon } from "@ui-kit/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { type ComponentProps, useCallback, useState } from "react";
import { openAppSettings } from "./AppSettingsTrigger";
import { ThemeMenuItem } from "./ThemeMenuItem";

interface UserMenuProps {
	showHomeLayoutControls?: boolean;
	showThemeToggle?: boolean;
	triggerVariant?: "default" | "glass";
}

const UserMenu = ({
	showHomeLayoutControls = false,
	showThemeToggle = false,
	triggerVariant = "default",
}: UserMenuProps) => {
	const { isWeb, isTauri, isNext } = usePlatform();
	const router = useRouter();
	const apiUrlCreator = ApiUrlCreatorService.value;
	const pageDataContext = PageDataContextService.value;
	const { isCurrentEnterpriseSession, shouldOpenTauriGesModal } = useDesktopEnterpriseSession();
	const { onLogoutClick, canLogoutEnterprise } = useSignOut();
	const userInfo = pageDataContext?.user?.info;
	const gesUrl = pageDataContext?.conf?.activeGesUrl;
	const isGesCloudEnabled = feature("ges-cloud");
	const isGesCloudLoggedIn = Boolean(isGesCloudEnabled && pageDataContext?.isLogged && !isCurrentEnterpriseSession);
	const isLogged = !!isCurrentEnterpriseSession || isGesCloudLoggedIn;
	const [dropdownOpen, setDropdownOpen] = useState(false);
	// Sign-in entry is shown only where it actually applies (enterprise endpoint
	// available, or a Tauri GES sign-in modal). Plain OSS/static have none.
	const canSignIn = !!gesUrl || (isTauri && shouldOpenTauriGesModal);
	const canSignInGesCloud = isTauri && isGesCloudEnabled && !pageDataContext?.isLogged;
	const hasEnterpriseSignInAction = !isLogged && canSignIn;
	const hasGesCloudSignInAction = !isLogged && canSignInGesCloud;
	const hasLogoutAction = isLogged && (canLogoutEnterprise || isGesCloudLoggedIn);
	const hasAuthAction = hasEnterpriseSignInAction || hasGesCloudSignInAction || hasLogoutAction;
	const currentWorkspaceName = pageDataContext.workspace.current;
	const workspaceConfig = pageDataContext.workspace.workspaces.find(
		(workspace) => workspace.path === currentWorkspaceName,
	);

	const enterpriseSignIn = useEnterpriseSignIn({ gesUrl, isWeb, isTauri, apiUrlCreator, router });

	const handleSignIn = async () => {
		if (isTauri && shouldOpenTauriGesModal) {
			ModalToOpenService.setValue(ModalToOpen.TauriGesSignIn);
			return;
		}
		if (!gesUrl) return;
		await enterpriseSignIn();
	};

	const handleGesCloudSignIn = useCallback(async () => {
		const gesCloudUrl = await GesCloudApi.getCloudInstanceUrl();
		if (!gesCloudUrl) return;

		const modalId = ModalToOpenService.addModal(ModalToOpen.GesCloudSignIn, {
			gesCloudUrl,
			allowContinueWithoutAccount: false,
			onClose: () => ModalToOpenService.removeModal(modalId),
		});
	}, []);

	const handleGesCloudLogout = useCallback(() => {
		if (!workspaceConfig) return;
		const modalId = ModalToOpenService.addModal<ComponentProps<typeof SignOutGesCloud>>(
			ModalToOpen.GesCloudSignOut,
			{
				workspaceConfig,
				onClose: () => ModalToOpenService.removeModal(modalId),
			},
		);
	}, [workspaceConfig]);

	const openSettings = () => openAppSettings(Level.app);
	const onOpenChange = async (open: boolean) => {
		if (open && !(await leaveEditModeGuard())) return;
		setDropdownOpen(open);
	};

	const fallback = getCode(userInfo?.name, userInfo?.mail);
	const avatar = isLogged ? (
		<Avatar size={triggerVariant === "glass" ? "lg" : "sm"}>
			<AvatarFallback uniqueId={userInfo?.mail ?? ""}>{fallback}</AvatarFallback>
		</Avatar>
	) : (
		<Icon className={triggerVariant === "default" ? "h-5 w-5 shrink-0 stroke-[1.6]" : ""} icon="user-round" />
	);

	return (
		<DropdownMenu onOpenChange={onOpenChange} open={dropdownOpen}>
			<Tooltip>
				<TooltipContent>
					<p>{isLogged ? (userInfo?.name ?? t("account")) : t("account")}</p>
				</TooltipContent>
				<TooltipTrigger asChild>
					{triggerVariant === "glass" ? (
						<DropdownMenuTrigger asChild>
							<GlassToolbarToggleButton
								active={dropdownOpen}
								aria-label={t("account")}
								className={cn(
									triggerVariant === "glass" &&
										isLogged &&
										"relative size-10 !p-0 after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:content-[''] hover:after:bg-alpha-high-90 data-[state=on]:after:bg-alpha-high-80",
								)}
								focusable
							>
								{avatar}
							</GlassToolbarToggleButton>
						</DropdownMenuTrigger>
					) : (
						<DropdownMenuTriggerButton
							aria-label={t("account")}
							className="aspect-square p-0"
							variant="ghost"
						>
							{avatar}
						</DropdownMenuTriggerButton>
					)}
				</TooltipTrigger>
			</Tooltip>
			<DropdownMenuContent align="end" className="min-w-[240px] rounded-xl">
				<DropdownMenuGroup>
					{isLogged ? (
						<>
							<DropdownMenuItem className="pointer-events-none">
								<AvatarLabel size="md">
									<AvatarLabelAvatar>
										<AvatarFallback>{fallback}</AvatarFallback>
									</AvatarLabelAvatar>
									<AvatarLabelTitle>{userInfo?.name ?? ""}</AvatarLabelTitle>
									<AvatarLabelDescription>{userInfo?.mail ?? ""}</AvatarLabelDescription>
								</AvatarLabel>
							</DropdownMenuItem>
						</>
					) : (
						<>
							<DropdownMenuLabel className="text-sm font-semibold">{t("account")}</DropdownMenuLabel>
						</>
					)}
					<DropdownMenuSeparator />

					{showHomeLayoutControls && <HomeLayoutControls />}
					{showThemeToggle && <ThemeMenuItem />}

					{!isNext && (
						<DropdownMenuItem className="rounded-lg" onSelect={openSettings}>
							<Icon icon="settings" />
							{t("app-settings.title")}
						</DropdownMenuItem>
					)}
					{hasAuthAction && <DropdownMenuSeparator />}
					{hasEnterpriseSignInAction && (
						<DropdownMenuItem className="rounded-lg" onSelect={handleSignIn}>
							<Icon icon="log-in" />
							{t("sing-in")}
						</DropdownMenuItem>
					)}
					{hasGesCloudSignInAction && (
						<DropdownMenuItem className="rounded-lg" onSelect={handleGesCloudSignIn}>
							<Icon icon="cloud" />
							{t("sing-in")}
						</DropdownMenuItem>
					)}
					{hasLogoutAction && (
						<DropdownMenuItem
							className="rounded-lg"
							onSelect={canLogoutEnterprise ? onLogoutClick : handleGesCloudLogout}
						>
							<Icon icon="log-out" />
							{t("sing-out")}
						</DropdownMenuItem>
					)}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

const getCode = (name?: string, mail?: string): string => {
	let code = getAvatarFallback(name ?? "");
	if (!code) code = mail?.[0] ?? "";
	return (code ?? "").toUpperCase();
};

export default UserMenu;
