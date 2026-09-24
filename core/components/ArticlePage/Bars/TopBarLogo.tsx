import Link from "@components/Atoms/Link";
import { CatalogLogo, SiteLogoLink } from "@components/CatalogLogo";
import Url from "@core-ui/ApiServices/Types/Url";
import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";

export const TopBarLogo = () => {
	const pageData = PageDataContext.value;
	const { name, link, title } = useCatalogPropsStore(
		(state) => ({
			name: state.data.name,
			link: state.data?.link,
			title: state.data?.title,
		}),
		"shallow",
	);

	const hasSiteLogo = !!pageData.conf.logo.imageUrl;

	return (
		<div className="flex h-8 min-w-0 flex-1 shrink-0 items-center gap-1">
			{hasSiteLogo && <SiteLogoLink />}
			<Link
				className="group/team flex h-8 min-w-0 flex-1 shrink-0 cursor-pointer items-center gap-2 rounded-lg p-0.5 pr-2 hover:bg-secondary-bg-hover"
				href={Url.from(link)}
			>
				{!hasSiteLogo && <CatalogLogo catalogName={name} />}
				<TextOverflowTooltip className="flex-1 font-sans font-medium text-primary-fg">
					{title || name}
				</TextOverflowTooltip>
			</Link>
		</div>
	);
};
