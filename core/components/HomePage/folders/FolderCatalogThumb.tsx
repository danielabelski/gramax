import resolveModule from "@app/resolveModule/frontend";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import type { CatalogLogo } from "@core-ui/ContextServices/CatalogLogoService/catalogLogoHooks";
import { cn } from "@core-ui/utils/cn";
import { getLogoEmoji, isLogoEmoji, isLogoIcon, parseLogoIcon } from "@ext/catalog/logo/catalogLogoIcon";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { useSetting } from "@ext/settings/logic/hooks";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import type { CSSProperties } from "react";
import { CatalogLogoContent } from "../CardParts/CardLogo";

const thumbInitials = (s: string) => s.slice(0, 2).toUpperCase();

interface FolderCatalogThumbProps {
	className?: string;
	link?: CatalogLink;
	name: string;
	style?: CSSProperties;
}

export const FolderCatalogThumb = ({ className, link, name, style: thumbStyle }: FolderCatalogThumbProps) => {
	const style = link?.style ? `var(--color-card-bg-${link.style})` : "var(--color-code-copy-bg)";
	const title = link?.title || name;
	const logo = link?.logo;
	const iconLogo = logo && isLogoIcon(logo) ? parseLogoIcon(logo) : null;
	const emojiLogo = logo && isLogoEmoji(logo) ? getLogoEmoji(logo) : null;
	const hasFileLogo = Boolean(logo && !iconLogo && !emojiLogo);

	const apiUrlCreator = ApiUrlCreatorService.value;
	const [theme] = useSetting("general.theme");
	const imageLogo = resolveModule("useImage")(hasFileLogo ? apiUrlCreator.getLogoUrl(name, theme) : null, [
		name,
		theme,
		hasFileLogo,
	]);

	const catalogLogo: CatalogLogo | null = iconLogo
		? { iconCode: iconLogo.code, iconColor: iconLogo.color }
		: emojiLogo
			? { emoji: emojiLogo }
			: imageLogo
				? { src: imageLogo }
				: null;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					aria-label={title}
					className={cn(
						"relative isolate flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-border bg-primary-bg text-[10px] font-bold text-primary-fg shadow-sm",
						className,
					)}
					role="img"
					style={thumbStyle}
				>
					<span aria-hidden className="absolute inset-0 -z-10 rounded-full" style={{ background: style }} />
					{catalogLogo ? (
						<CatalogLogoContent className="m-0 size-4 text-base" logo={catalogLogo} />
					) : (
						thumbInitials(title)
					)}
				</div>
			</TooltipTrigger>
			<TooltipContent className="px-3 pb-3 pt-2.5" collisionPadding={8} side="top" sideOffset={8}>
				<div className="flex max-w-72 flex-col items-start gap-1">
					<span className="text-sm font-medium text-inverse-primary-fg">{title}</span>
					{link?.description && (
						<span className="line-clamp-2 text-xs text-inverse-secondary-fg">{link.description}</span>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	);
};
