import { cn } from "@core-ui/utils/cn";
import t, { pluralize } from "@ext/localization/locale/translate";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useMemo } from "react";
import type { HomeFolder } from "../utils/homeLayoutTypes";
import { FolderCatalogThumb } from "./FolderCatalogThumb";

const MAX_VISIBLE_THUMBS = 3;
const MAX_MORE_COUNT = 9;
const previewItemClassName =
	"transition-[margin] duration-200 ease-out [&:not(:first-child)]:-ml-3 group-hover/folder-thumbs:[&:not(:first-child)]:ml-0 group-focus-within/folder-thumbs:[&:not(:first-child)]:ml-0";

export const catalogsLabel = (n: number) =>
	pluralize(n, {
		one: t("folder-catalogs-count-one"),
		few: t("folder-catalogs-count-few"),
		many: t("folder-catalogs-count-many"),
	});

interface FolderCatalogThumbsProps {
	folder: HomeFolder;
	linkByName: Record<string, CatalogLink>;
}

export const FolderCatalogThumbs = ({ folder, linkByName }: FolderCatalogThumbsProps) => {
	const { shown, hidden, moreCount, previewCount } = useMemo(() => {
		const shown = folder.items.slice(0, MAX_VISIBLE_THUMBS);
		const hidden = folder.items.slice(MAX_VISIBLE_THUMBS);
		const moreCount = Math.min(hidden.length, MAX_MORE_COUNT);

		return { shown, hidden, moreCount, previewCount: shown.length + (moreCount > 0 ? 1 : 0) };
	}, [folder.items]);

	return (
		<div className="group/folder-thumbs flex gap-0 mt-auto transition-[gap] duration-200 ease-out hover:gap-1.5 focus-within:gap-1.5">
			{shown.map((name, index) => {
				const link = linkByName[name];
				return (
					<FolderCatalogThumb
						className={previewItemClassName}
						key={name}
						link={link}
						name={name}
						style={{ zIndex: previewCount - index }}
					/>
				);
			})}
			{moreCount > 0 && (
				<Tooltip>
					<TooltipTrigger asChild>
						<div
							className={cn(
								"flex size-9 shrink-0 items-center justify-center rounded-full border border-primary-border bg-primary-bg text-xs font-semibold text-secondary-fg shadow-sm",
								previewItemClassName,
							)}
							onClick={(e) => e.stopPropagation()}
							onPointerDown={(e) => e.stopPropagation()}
							style={{ zIndex: 1 }}
						>
							+{moreCount}
						</div>
					</TooltipTrigger>
					<TooltipContent className="px-3 pb-3 pt-2.5" collisionPadding={8} side="top" sideOffset={8}>
						<div className="text-sm font-medium text-inverse-primary-fg">
							{t("folder-more-catalogs")} {catalogsLabel(hidden.length)}
						</div>
						<div className="mt-1 max-w-72 text-xs leading-5 text-inverse-secondary-fg">
							{hidden.map((name) => linkByName[name]?.title || name).join(", ")}
						</div>
					</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
};
