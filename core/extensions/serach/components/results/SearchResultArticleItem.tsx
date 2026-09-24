import Link from "@components/Atoms/Link";
import type Url from "@core-ui/ApiServices/Types/Url";
import { useGetCatalogLogoSrc } from "@core-ui/ContextServices/CatalogLogoService/catalogLogoHooks";
import t from "@ext/localization/locale/translate";
import { CatalogLogoMark } from "@ext/serach/components/CatalogLogoMark";
import { SearchBreadcrumbLink } from "@ext/serach/components/results/SearchBreadcrumbLink";
import { SearchMarkedText } from "@ext/serach/components/results/SearchMarkedText";
import { SearchResultBadge } from "@ext/serach/components/results/SearchResultBadge";
import { SearchResultMatch } from "@ext/serach/components/results/SearchResultMatch";
import { searchLinkClick } from "@ext/serach/components/utils/searchLinkClick";
import type { SearchResultMarkItem } from "@ext/serach/Searcher";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@ui-kit/Breadcrumb";

export interface SearchResultArticleItemProps {
	catalog: {
		name: string;
		title: string;
		url: string;
	};
	breadcrumbs: {
		title: SearchResultMarkItem[];
		url: string;
	}[];
	title: SearchResultMarkItem[];
	url: Url;
	isRecommended: boolean;
	isCurrent: boolean;
	showCatalog: boolean;
	onOpen: () => void;
	onBreadcrumbOpen: (pathname: string) => void;
}

export const SearchResultArticleItem = (props: SearchResultArticleItemProps) => {
	const { catalog, breadcrumbs, title, url, isCurrent, isRecommended, showCatalog, onOpen, onBreadcrumbOpen } = props;
	const { logo } = useGetCatalogLogoSrc(catalog.name);

	const hasBreadcrumbs = breadcrumbs.length > 0;
	const hasCrumbLine = showCatalog || hasBreadcrumbs;
	const firstBreadcrumb = breadcrumbs[0];
	const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];

	const shouldCollapse = breadcrumbs.length > 2;
	const collapsedHighlighted = shouldCollapse && breadcrumbs.slice(1, -1).some((x) => hasHighlightedMark(x.title));

	return (
		<div className="py-2 px-2.5 space-y-1 min-w-0 overflow-hidden">
			{hasCrumbLine && (
				<div className="text-muted [&_a]:text-muted text-xs min-w-0 w-full overflow-hidden">
					<Breadcrumb className="w-full min-w-0 overflow-hidden">
						<BreadcrumbList className="w-full min-w-0 max-w-full flex-nowrap overflow-hidden text-xs">
							{/* Catalog */}
							{showCatalog && (
								<>
									<BreadcrumbItem className="p-0 shrink-0 max-w-[15%]">
										<BreadcrumbLink asChild className="flex items-center gap-1 truncate">
											<Link
												href={{ pathname: catalog.url }}
												onClick={searchLinkClick(() => onBreadcrumbOpen(catalog.url))}
												tabIndex={-1}
											>
												<CatalogLogoMark logo={logo} name={catalog.name} />

												<span className="truncate">{catalog.title}</span>
											</Link>
										</BreadcrumbLink>
									</BreadcrumbItem>

									{hasBreadcrumbs && (
										<BreadcrumbSeparator className="shrink-0">
											<span className="text-muted">/</span>
										</BreadcrumbSeparator>
									)}
								</>
							)}

							{/* First breadcrumb */}
							{firstBreadcrumb && (
								<BreadcrumbItem className="p-0 min-w-0 max-w-[30%] shrink overflow-hidden">
									<SearchBreadcrumbLink
										onOpen={onBreadcrumbOpen}
										title={firstBreadcrumb.title}
										url={firstBreadcrumb.url}
									/>
								</BreadcrumbItem>
							)}

							{/* Middle collapsed */}
							{shouldCollapse && (
								<>
									<BreadcrumbSeparator className="shrink-0">
										<span className="text-muted">/</span>
									</BreadcrumbSeparator>

									<BreadcrumbItem className="p-0 shrink-0">
										{collapsedHighlighted ? <SearchResultMatch text="..." /> : "..."}
									</BreadcrumbItem>
								</>
							)}

							{/* Last breadcrumb */}
							{lastBreadcrumb && lastBreadcrumb !== firstBreadcrumb && (
								<>
									<BreadcrumbSeparator className="shrink-0">
										<span className="text-muted">/</span>
									</BreadcrumbSeparator>

									<BreadcrumbItem className="p-0 flex-1 min-w-0 overflow-hidden">
										<SearchBreadcrumbLink
											onOpen={onBreadcrumbOpen}
											title={lastBreadcrumb.title}
											url={lastBreadcrumb.url}
										/>
									</BreadcrumbItem>
								</>
							)}
						</BreadcrumbList>
					</Breadcrumb>
				</div>
			)}
			<Link
				className="flex justify-between text-sm text-primary-fg"
				href={url}
				onClick={searchLinkClick(onOpen)}
				tabIndex={-1}
			>
				<span className="font-medium">
					<SearchMarkedText marks={title} />
				</span>
				<div className="flex items-center gap-2.5">
					{isCurrent && (
						<SearchResultBadge
							className="border border-status-info-primary-border bg-status-info-bg"
							text={t("search.current")}
						/>
					)}
					{isRecommended && (
						<SearchResultBadge
							className="border border-status-info-primary-border bg-status-info-bg"
							icon="star"
							text={t("search.recommended")}
						/>
					)}
				</div>
			</Link>
		</div>
	);
};

const hasHighlightedMark = (marks: SearchResultMarkItem[]) => marks.some((mark) => mark.type === "highlight");
