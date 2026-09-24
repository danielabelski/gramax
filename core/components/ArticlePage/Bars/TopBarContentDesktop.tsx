import { TopBarHomeLink } from "@components/ArticlePage/Bars/TopBarHomeLink";
import { TopBarLogo } from "@components/ArticlePage/Bars/TopBarLogo";
import { TooltipIconButton } from "@components/Atoms/TooltipIconButton";
import t from "@ext/localization/locale/translate";

export const TopBarContentDesktop = () => (
	<>
		<TopBarHomeLink>
			<TooltipIconButton icon="grip" iconClassName="size-4" size="sm" tooltip={t("home")} variant="ghost" />
		</TopBarHomeLink>
		<TopBarLogo />
	</>
);

export default TopBarContentDesktop;
