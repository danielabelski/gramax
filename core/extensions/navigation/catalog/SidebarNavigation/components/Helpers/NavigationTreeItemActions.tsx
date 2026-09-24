import IsMobileService from "@core-ui/ContextServices/isMobileService";
import { cn } from "@core-ui/utils/cn";
import EditMenu from "@ext/item/EditMenu";
import t from "@ext/localization/locale/translate";
import { useLazyAnimatedPresence } from "@ext/navigation/catalog/SidebarNavigation/hooks/useLazyAnimatedPresence";
import { useParentNavigationControl } from "@ext/navigation/catalog/SidebarNavigation/hooks/useParentNavigationControl";
import { useNavigationTreeStore } from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useRef, useState } from "react";

const ACTIONS_EXIT_FALLBACK_MS = 250;

interface NavigationTreeItemActionsProps {
	itemLink?: ItemLink;
	onAddChild?: () => void;
}

export const NavigationTreeItemActions = (props: NavigationTreeItemActionsProps) => {
	const isMobile = IsMobileService.value;
	if (isMobile) return <span aria-hidden className="hidden" />;
	return <DesktopNavigationTreeItemActions {...props} />;
};

const DesktopNavigationTreeItemActions = ({ itemLink, onAddChild }: NavigationTreeItemActionsProps) => {
	const [currentItemLink, setCurrentItemLink] = useState<ItemLink>(itemLink);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const markerRef = useRef<HTMLSpanElement>(null);
	const isDndActive = useNavigationTreeStore((state) => state.draggingId !== null);
	const isParentActive = useParentNavigationControl(markerRef, isDropdownOpen);
	const shouldShowActions = (itemLink?.isCurrentLink || isParentActive) && (!isDndActive || isDropdownOpen);
	const {
		isPresent: areActionsMounted,
		isVisible: areActionsVisible,
		onTransitionEnd: handleActionsTransitionEnd,
	} = useLazyAnimatedPresence({
		closeImmediately: isDndActive && !isDropdownOpen,
		exitFallbackMs: ACTIONS_EXIT_FALLBACK_MS,
		isOpen: shouldShowActions,
	});

	if (!areActionsMounted) return <span aria-hidden className="hidden" ref={markerRef} />;

	const moreButton = (
		<button
			aria-label={t("article.actions.title")}
			className="hover:bg-sidebar-accent group/actions m-0 flex size-5 appearance-none items-center justify-center rounded border-0 bg-transparent p-0 text-left text-muted-foreground"
			data-testid="article-actions"
			type="button"
		>
			<Icon className="group-hover/actions:text-primary-fg" icon="more-horizontal" />
		</button>
	);

	const moreButtonTooltipTrigger = <TooltipTrigger asChild>{moreButton}</TooltipTrigger>;

	// Keep the dropdown trigger outside the tooltip trigger so the dropdown owns Radix's shared `data-state`.
	const moreButtonWithTooltip = (
		<Tooltip>
			{itemLink ? (
				<DropdownMenuTrigger asChild>{moreButtonTooltipTrigger}</DropdownMenuTrigger>
			) : (
				moreButtonTooltipTrigger
			)}
			<TooltipContent focus="high">{t("article.actions.title")}</TooltipContent>
		</Tooltip>
	);

	return (
		<ComponentVariantProvider variant="glass">
			<span
				className={cn(
					"right-extensions ml-auto flex max-w-12 shrink-0 overflow-hidden",
					"sm:duration-150 sm:transition-[max-width] sm:[transition-timing-function:cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
					areActionsVisible ? "sm:max-w-12 sm:delay-0" : "sm:max-w-0 sm:delay-75",
				)}
				data-state={areActionsVisible ? "open" : "closed"}
				data-testid="navigation-tree-actions"
				onTransitionEnd={handleActionsTransitionEnd}
				ref={markerRef}
			>
				<span
					className={cn(
						"flex translate-x-0 items-center gap-1 opacity-100",
						"sm:transition-[transform,opacity] motion-reduce:transition-none",
						areActionsVisible
							? "sm:translate-x-0 sm:opacity-100 sm:delay-50 sm:duration-150 sm:[transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
							: "sm:translate-x-2 sm:opacity-0 sm:delay-0 sm:duration-100 sm:ease-out",
					)}
					data-testid="navigation-tree-actions-motion"
				>
					{onAddChild && (
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									aria-label={t("article.add-child")}
									className="hover:bg-sidebar-accent group/add m-0 flex size-5 appearance-none items-center justify-center rounded border-0 bg-transparent p-0 text-left text-muted-foreground"
									data-testid="create-article"
									onClick={onAddChild}
									type="button"
								>
									<Icon className="group-hover/add:text-primary-fg" icon="plus" />
								</button>
							</TooltipTrigger>
							<TooltipContent focus="high">{t("article.add-child")}</TooltipContent>
						</Tooltip>
					)}
					{itemLink ? (
						<DropdownMenu modal={false} onOpenChange={setIsDropdownOpen} open={isDropdownOpen}>
							{moreButtonWithTooltip}
							<DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()} side="right">
								<EditMenu itemLink={currentItemLink} setItemLink={setCurrentItemLink} />
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						moreButtonWithTooltip
					)}
				</span>
			</span>
		</ComponentVariantProvider>
	);
};
