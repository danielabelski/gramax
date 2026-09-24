import Link from "@components/Atoms/Link";
import { SearchMarkedText } from "@ext/serach/components/results/SearchMarkedText";
import { searchLinkClick } from "@ext/serach/components/utils/searchLinkClick";
import type { SearchResultMarkItem } from "@ext/serach/Searcher";
import { BreadcrumbLink } from "@ui-kit/Breadcrumb";
import { Tooltip, TooltipContent, TooltipTrigger, useOverflowTooltip } from "@ui-kit/Tooltip";

export interface SearchBreadcrumbLinkProps {
	title: SearchResultMarkItem[];
	url: string;
	onOpen: (pathname: string) => void;
}

export const SearchBreadcrumbLink = (props: SearchBreadcrumbLinkProps) => {
	const { title, url, onOpen } = props;
	const { open, onOpenChange, ref } = useOverflowTooltip<HTMLAnchorElement>();

	return (
		<Tooltip onOpenChange={onOpenChange} open={open}>
			<TooltipTrigger asChild>
				<BreadcrumbLink asChild className="block truncate">
					<Link href={{ pathname: url }} onClick={searchLinkClick(() => onOpen(url))} ref={ref} tabIndex={-1}>
						<SearchMarkedText marks={title} />
					</Link>
				</BreadcrumbLink>
			</TooltipTrigger>
			<TooltipContent arrow={false} focus="default">
				<SearchMarkedText marks={title} />
			</TooltipContent>
		</Tooltip>
	);
};
