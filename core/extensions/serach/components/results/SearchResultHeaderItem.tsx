import { SearchMarkedText } from "@ext/serach/components/results/SearchMarkedText";
import { SearchResultRow } from "@ext/serach/components/results/SearchResultRow";
import type { SearchResultMarkItem } from "@ext/serach/Searcher";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@ui-kit/Breadcrumb";
import { Fragment } from "react";

export interface SearchResultHeaderItemProps {
	breadcrumbs: SearchResultMarkItem[][];
}

export const SearchResultHeaderItem = (props: SearchResultHeaderItemProps) => {
	const { breadcrumbs } = props;

	return (
		<SearchResultRow tone="heading">
			<Breadcrumb>
				<BreadcrumbList>
					{breadcrumbs.map((x, i) => {
						const isLast = i === breadcrumbs.length - 1;
						const addSeparator = !isLast;
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: idc
							<Fragment key={i}>
								<BreadcrumbItem className="p-0 text-secondary-fg">
									<span>
										<SearchMarkedText marks={x} />
									</span>
								</BreadcrumbItem>
								{addSeparator && (
									<BreadcrumbSeparator>
										<span className="text-muted">/</span>
									</BreadcrumbSeparator>
								)}
							</Fragment>
						);
					})}
				</BreadcrumbList>
			</Breadcrumb>
		</SearchResultRow>
	);
};
