import type { CatalogLogo } from "@core-ui/ContextServices/CatalogLogoService/catalogLogoHooks";
import { cn } from "@core-ui/utils/cn";
import { Icon, type IconCode } from "@ui-kit/Icon";

interface CatalogLogoMarkProps {
	logo: CatalogLogo;
	name: string;
	className?: string;
}

export const CatalogLogoMark = (props: CatalogLogoMarkProps) => {
	const { logo, name, className } = props;

	if (!logo) return null;

	if ("iconCode" in logo)
		return (
			<Icon
				className={cn("size-4 shrink-0", className)}
				color={logo.iconColor ? `var(--color-icon-${logo.iconColor})` : undefined}
				icon={logo.iconCode as IconCode}
			/>
		);

	if ("emoji" in logo)
		return (
			<span className={cn("size-4 shrink-0 inline-flex items-center justify-center leading-none", className)}>
				{logo.emoji}
			</span>
		);

	return <img alt={name} className={cn("size-4 p-px shrink-0", className)} src={logo.src} />;
};
