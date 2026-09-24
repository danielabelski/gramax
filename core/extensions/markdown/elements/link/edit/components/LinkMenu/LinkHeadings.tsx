/** biome-ignore-all lint/correctness/useExhaustiveDependencies: valid dependencies */
import { type TitleItem, useFetchArticleHeaders } from "@core-ui/ContextServices/LinkTitleTooltip";
import type LinkItem from "@ext/article/LinkCreator/models/LinkItem";
import t from "@ext/localization/locale/translate";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@ui-kit/Dropdown";
import { Loader } from "@ui-kit/Loader";
import { MenuItemIconButton } from "@ui-kit/MenuItem";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { useCallback } from "react";

interface LinkHeadingsProps {
	linkItem: LinkItem;
	onUpdate?: (relativePath: string, href: string) => void;
}

export const LinkHeadings = ({ linkItem, onUpdate }: LinkHeadingsProps) => {
	const { isLoading, headers, fetchArticleHeaders } = useFetchArticleHeaders({ linkItem });

	const handleHeaderClick = useCallback(
		(header: TitleItem) => {
			if (!onUpdate) return;

			const relativePath = linkItem.relativePath;
			const href = linkItem.pathname + header.url;

			onUpdate(relativePath, href);
		},
		[linkItem, onUpdate],
	);

	const onOpenChange = useCallback((open: boolean) => {
		if (open) void fetchArticleHeaders();
	}, []);

	return (
		<ComponentVariantProvider variant="glass">
			<DropdownMenu modal={false} onOpenChange={onOpenChange}>
				<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
					<div>
						<MenuItemIconButton className="w-5 h-5" icon="chevron-right" size="xs" />
					</div>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="max-h-[20rem] overflow-y-auto"
					onClick={(event) => event.stopPropagation()}
					side="right"
				>
					<DropdownMenuLabel className="text-xs font-normal text-inverse-muted">
						{t("article-titles")}
					</DropdownMenuLabel>
					{!headers.length && (
						<DropdownMenuItem className="text-xs" disabled>
							{t("article.links.no-links")}
						</DropdownMenuItem>
					)}
					{!isLoading &&
						headers.map((header) => (
							<DropdownMenuItem
								className="text-xs"
								key={header.url}
								onSelect={() => handleHeaderClick(header)}
							>
								<span>{header.title}</span>
							</DropdownMenuItem>
						))}
					{isLoading && (
						<DropdownMenuItem className="text-xs">
							<Loader size="xs" />
							{t("loading")}
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</ComponentVariantProvider>
	);
};
