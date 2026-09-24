import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import CatalogLogoService from "@core-ui/ContextServices/CatalogLogoService/Context";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import IconComponent from "@ext/markdown/elements/icon/render/components/Icon";
import { type HTMLAttributes, useState } from "react";

const LogoWrapper = ({ className, ...otherProps }: HTMLAttributes<HTMLDivElement>) => {
	return <div className={cn("size-7 shrink-0 rounded-lg", className)} {...otherProps} />;
};

export const SiteLogoLink = () => {
	const [isError, setIsError] = useState(false);
	const logoData = PageDataContextService.value.conf.logo;
	const url = logoData.linkUrl;
	const imageSrc = logoData?.imageUrl;
	const title = logoData?.linkTitle ?? (url !== "/" ? `${t("go-to")} ${url}` : null);

	if (isError) return null;
	return (
		<a
			className="flex shrink-0 cursor-pointer items-center rounded-lg p-0.5 hover:bg-secondary-bg-hover"
			href={url}
			title={title}
		>
			<LogoWrapper>
				<img className="h-7 w-7" onError={() => setIsError(true)} src={imageSrc} />
			</LogoWrapper>
		</a>
	);
};

export const CatalogLogo = ({ catalogName }: { catalogName?: string }) => {
	const { logo } = CatalogLogoService.value();
	const { isStaticCli } = usePlatform();
	if (isStaticCli) return null;

	if (!logo) return null;
	if ("iconCode" in logo)
		return (
			<LogoWrapper>
				<IconComponent
					className="w-[1.625rem] box-content shrink-0"
					code={logo.iconCode as IconCode}
					color={logo.iconColor}
					data-testid="catalog-logo-icon"
				/>
			</LogoWrapper>
		);
	if ("emoji" in logo)
		return (
			<LogoWrapper>
				<span className="text-xl leading-none shrink-0 pr-[10px]" data-testid="catalog-logo-emoji">
					{logo.emoji}
				</span>
			</LogoWrapper>
		);
	return (
		<LogoWrapper>
			<img alt={catalogName} className="h-7 w-7" data-testid="catalog-logo-image" src={logo.src} />
		</LogoWrapper>
	);
};
