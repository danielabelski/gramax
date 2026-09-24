import Link from "@components/Atoms/Link";
import { useRouter } from "@core/Api/useRouter";
import Url from "@core-ui/ApiServices/Types/Url";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { SIDEBAR_TRIGGER_ATTR } from "@core-ui/hooks/useSidebarFloating";
import t from "@ext/localization/locale/translate";
import { IconButton } from "@ui-kit/Button";
import { SidebarTrigger } from "@ui-kit/Sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";

const sidebarTriggerProps = { [SIDEBAR_TRIGGER_ATTR]: true };

const BUTTON_CLASS = "shrink-0 rounded-full p-2 hover:!bg-secondary-border";

export const CollapsedNavigationToolbar = () => {
	const router = useRouter();
	const { logo, cloudServiceUrl } = PageDataContextService.value.conf;
	const { isStatic, isStaticCli } = usePlatform();
	const showHomePageButton = (!(isStatic || isStaticCli) || cloudServiceUrl) && !logo.imageUrl;

	return (
		<div
			className="fixed flex flex-row gap-0.5 rounded-full bg-alpha-50 px-1.5 py-1 shadow-glass-sm"
			style={{
				left: VIEWPORT_PADDING,
				top: `calc(var(--catalog-titlebar-offset,0rem) + ${VIEWPORT_PADDING}px)`,
				zIndex: "var(--z-index-toolbar)",
			}}
		>
			{showHomePageButton && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							className="flex"
							dataQa="home-page-button"
							href={Url.fromRouter(router, { pathname: "/" })}
						>
							<IconButton
								className={BUTTON_CLASS}
								icon="grip"
								iconClassName="size-4"
								size="sm"
								variant="ghost"
							/>
						</Link>
					</TooltipTrigger>
					<TooltipContent focus="high">{t("home")}</TooltipContent>
				</Tooltip>
			)}
			<Tooltip>
				<TooltipTrigger asChild>
					<SidebarTrigger
						className={BUTTON_CLASS}
						iconClassName="size-4"
						size="sm"
						{...sidebarTriggerProps}
					/>
				</TooltipTrigger>
				<TooltipContent focus="high" side="right">
					{t("left-navigation.expand")}
				</TooltipContent>
			</Tooltip>
		</div>
	);
};

export default CollapsedNavigationToolbar;
