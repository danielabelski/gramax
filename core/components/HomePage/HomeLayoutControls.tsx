import t from "@ext/localization/locale/translate";
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { Tabs, TabsList, TabsTrigger } from "@ui-kit/Tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useHomeLayoutControls } from "./hooks/useHomeLayoutControls";
import type { HomeLayoutEditScope } from "./utils/homeLayoutTypes";

const HomeLayoutControls = () => {
	const {
		activeView,
		beginEdit,
		canShowSharedView,
		editDisabledByDuplicateCatalog,
		editDisabledByPermission,
		editScopeTarget,
		isEditing,
		isVisible,
		setActiveView,
	} = useHomeLayoutControls();

	if (!isVisible) return null;

	const editButtonLabel = !canShowSharedView
		? t("configure-home-view")
		: editScopeTarget === "personal"
			? t("configure-personal-view")
			: t("configure-view-for-everyone");
	return (
		<>
			<DropdownMenuGroup className="space-y-1">
				{canShowSharedView && (
					<>
						<DropdownMenuLabel className="text-xs text-muted font-medium">
							{t("home-view")}
						</DropdownMenuLabel>
						<Tabs onValueChange={(value) => setActiveView(value as HomeLayoutEditScope)} value={activeView}>
							<TabsList aria-label={t("home-view")} className="w-full lg:h-7 h-7 p-0.5">
								<TabsTrigger
									className="w-1/2 !py-0.5 data-[state=active]:bg-primary-bg"
									disabled={isEditing}
									value="personal"
								>
									<span className="inline-block w-14">{t("personal-view")}</span>
								</TabsTrigger>
								<TabsTrigger
									className="w-1/2 !py-0.5 data-[state=active]:bg-primary-bg"
									disabled={isEditing}
									value="global"
								>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-block w-14">{t("shared-view")}</span>
										</TooltipTrigger>
										<TooltipContent>{t("shared-homepage-view-description")}</TooltipContent>
									</Tooltip>
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</>
				)}
				<Tooltip>
					<TooltipTrigger asChild>
						<DropdownMenuItem
							className="rounded-lg"
							data-qa="qa-clickable"
							disabled={isEditing || editDisabledByPermission || editDisabledByDuplicateCatalog}
							onSelect={() => beginEdit(editScopeTarget)}
						>
							<Icon icon="pen-line" />
							{editButtonLabel}
						</DropdownMenuItem>
					</TooltipTrigger>
					{editDisabledByPermission ? (
						<TooltipContent>{t("only-workspace-owner-can-edit-shared-view")}</TooltipContent>
					) : (
						editDisabledByDuplicateCatalog && (
							<TooltipContent>{t("edit-homepage-view-disabled-duplicate-catalog")}</TooltipContent>
						)
					)}
				</Tooltip>
			</DropdownMenuGroup>
			<DropdownMenuSeparator className="mx-0" />
		</>
	);
};

export default HomeLayoutControls;
