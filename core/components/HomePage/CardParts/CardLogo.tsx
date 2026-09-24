import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import type { CatalogLogo } from "@core-ui/ContextServices/CatalogLogoService/catalogLogoHooks";
import { cn } from "@core-ui/utils/cn";
import { CardVisualBadge } from "@ui-kit/Card";
import { Icon } from "@ui-kit/Icon";
import type { HTMLAttributes } from "react";

interface CardLogoProps extends HTMLAttributes<HTMLDivElement> {
	logo: CatalogLogo | null;
}

interface CatalogLogoContentProps {
	logo: CatalogLogo | null;
	className?: string;
}

const resolveCatalogLogoElement = ({ logo, className }: CatalogLogoContentProps) => {
	if (!logo) return null;

	if ("iconCode" in logo && logo?.iconCode) {
		return (
			<Icon
				className={cn("h-full w-full ml-0.5 mt-0.5", className)}
				color={logo?.iconColor ? `var(--color-icon-${logo?.iconColor})` : undefined}
				icon={logo?.iconCode as IconCode}
			/>
		);
	}

	if ("emoji" in logo && logo?.emoji) {
		return (
			<span className={cn("flex items-center justify-center h-full w-full text-5xl leading-none", className)}>
				{logo.emoji}
			</span>
		);
	}

	if ("src" in logo && logo?.src) {
		return (
			<div
				className={cn("h-full w-full ml-0.5 mt-0.5", className)}
				style={{
					backgroundImage: `url(${logo.src})`,
					backgroundSize: "contain",
					backgroundPosition: "center center",
					backgroundRepeat: "no-repeat",
				}}
			/>
		);
	}

	return null;
};

export const CatalogLogoContent = (props: CatalogLogoContentProps) => resolveCatalogLogoElement(props);

export const CardLogo = ({ logo, className, ...props }: CardLogoProps) => {
	const logoElement = resolveCatalogLogoElement({ logo });
	if (!logoElement) return null;
	return (
		<CardVisualBadge className={cn("-bottom-0.5 -right-0.5", className)} {...props}>
			{logoElement}
		</CardVisualBadge>
	);
};
